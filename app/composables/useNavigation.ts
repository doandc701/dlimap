import type { SearchResult, ClosedExpressway, LngLat, Poi, RouteResult, TollSource, TollStation, TravelMode, VehicleClass } from '#shared/types'

export interface Place {
  name: string
  address?: string
  lat: number
  lon: number
  /** from search: what it is (icon) and whether a typed house number is only placed on its street */
  kind?: SearchResult['kind']
  category?: string
  approx?: boolean
}

export type AlongPoi = Poi & { along: number }
export interface AlongToll {
  id: string
  name: string
  kind: 'open' | 'closed'
  lat: number
  lon: number
  along: number
  /** open station: price per trip by class */
  prices?: Record<VehicleClass, number> | null
  /** closed expressway: đ/km by class, and km driven on it */
  perKm?: Record<VehicleClass, number | null> | null
  km?: number
  /** for the current vehicle class; null = no sourced price */
  price: number | null
  source?: TollSource
}

interface PoisResponse { pois: Poi[]; tolls: TollStation[] }

let expressways: ClosedExpressway[] = []
let expresswaysLoaded: Promise<void> | null = null

/** Closed-expressway tariffs; cached in localStorage so toll estimates also work offline. */
function loadExpressways(): Promise<void> {
  return (expresswaysLoaded ??= $fetch<ClosedExpressway[]>('/api/tolls')
    .then((t) => {
      expressways = t
      try { localStorage.setItem('dlimap:expressways', JSON.stringify(t)) } catch {}
    })
    .catch(() => {
      expresswaysLoaded = null
      try { expressways = JSON.parse(localStorage.getItem('dlimap:expressways') ?? '[]') } catch {}
    }))
}

function priceOf(t: AlongToll, vc: VehicleClass): number | null {
  if (t.kind === 'open') return t.prices?.[vc] ?? null
  const rate = t.perKm?.[vc]
  return rate != null && t.km != null ? Math.round((t.km * rate) / 1000) * 1000 : null
}

/** Group route steps driven on expressways into toll segments. */
function expresswaySegments(r: RouteResult, cum: number[], table: ClosedExpressway[], vc: VehicleClass): AlongToll[] {
  const out: AlongToll[] = []
  for (const st of r.steps) {
    const text = normName(`${st.name} ${st.ref ?? ''}`)
    const isExpressway = text.includes('cao tốc') || /\bct ?\d/.test(text)
    if (!isExpressway || st.distance < 50) continue
    const e = table.find((x) => x.keywords.some((k) => text.includes(normName(k))))
    const start = cum[st.geomIndex] ?? 0
    const last = out[out.length - 1]
    const adjacent = !!last && start - (last.along + last.km! * 1000) < 2000
    // unnamed pieces (interchange ramps, flyovers) belong to the expressway they connect
    const name = e?.name ?? (adjacent ? last!.name : st.name || st.ref || 'Đường cao tốc')
    if (adjacent && last!.name === name) {
      last.km! += st.distance / 1000
    } else {
      out.push({
        id: `cao-toc:${name}:${Math.round(start)}`, name, kind: 'closed', lat: st.location[1], lon: st.location[0],
        along: start, perKm: e?.perKm ?? null, km: st.distance / 1000, price: null, source: e?.source,
      })
    }
  }
  // drop short stray pieces that matched no known expressway (ramps before the main road)
  const segs = out.filter((t) => t.source || t.km! >= 2)
  for (const t of segs) t.price = priceOf(t, vc)
  return segs
}

export interface Progress {
  along: number
  index: number
  point: LngLat
  offRoute: boolean
  stepIdx: number
  distToStep: number
  remaining: number
  remainingTime: number
}

interface NavState {
  origin: Place | null
  destination: Place | null
  routes: RouteResult[]
  /** routes of every travel mode for the current trip (filled in the background) */
  modeRoutes: Partial<Record<TravelMode, RouteResult[]>>
  selected: number
  active: boolean
  simulating: boolean
  simFactor: number
  progress: Progress | null
  pois: AlongPoi[]
  tolls: AlongToll[]
  loading: boolean
  poisLoading: boolean
  /** Overpass failed: cameras / toll booths along the route are unknown */
  poisError: boolean
  error: string
  offlineRoute: boolean
}

const cumCache = new WeakMap<object, number[]>()
let simTimer: ReturnType<typeof setInterval> | null = null
let offCount = 0
let lastReroute = 0
const spoken = new Set<string>()
let lastPrefetchStep = -1
let planSeq = 0

const PROMPT_DISTANCES = [1000, 300, 60] as const

/** Fixed wording per threshold, so prompt audio can be generated ahead of time. */
function promptText(instruction: string, th: number): string {
  if (th === 60) return instruction
  return `${th >= 1000 ? `${th / 1000} ki lô mét` : `${th} mét`} nữa, ${instruction[0]!.toLowerCase()}${instruction.slice(1)}`
}

/**
 * A tunnel / no-overtaking way only matters if the route actually runs along it,
 * not when it merely crosses it (e.g. an underpass beneath the route).
 */
function followsRoute(way: LngLat[], line: LngLat[], cum: number[]): boolean {
  if (haversine(way[0]!, way[way.length - 1]!) < 60) return false
  const near = way.filter((p) => snapToLine(p, line, cum).dist < 15).length
  return near / way.length >= 0.6
}

export function routeCum(r: RouteResult): number[] {
  let c = cumCache.get(r)
  if (!c) cumCache.set(r, (c = cumulative(r.geometry)))
  return c
}

function createNavigation() {
  const nav = useState<NavState>('nav', () => ({
    origin: null, destination: null, routes: [], modeRoutes: {}, selected: 0,
    active: false, simulating: false, simFactor: 1,
    progress: null, pois: [], tolls: [],
    loading: false, poisLoading: false, poisError: false, error: '', offlineRoute: false,
  }))
  const { pos, setSimulated, endSimulation } = usePosition()
  const settings = useSettings()
  const { say, prefetch } = useVoice()
  const online = useOnline()
  const routeTraffic = useState<RouteTraffic | null>('routeTraffic', () => null)

  const route = computed(() => nav.value.routes[nav.value.selected] ?? null)
  const tollTotal = computed(() => nav.value.tolls.reduce((s, t) => s + (t.price ?? 0), 0))
  /** toll items on the route without a sourced price */
  const tollUnknown = computed(() => nav.value.tolls.filter((t) => t.price == null).length)

  function originLngLat(): LngLat | null {
    if (nav.value.origin) return [nav.value.origin.lon, nav.value.origin.lat]
    return pos.value.lngLat
  }

  /** Find routes to the destination; `from` (+ `heading`) is a reroute from the vehicle's position. */
  async function plan(from?: LngLat, heading?: number) {
    const o = from ?? originLngLat()
    const d = nav.value.destination
    if (!o || !d) {
      nav.value.error = !o ? 'Chưa có vị trí xuất phát – hãy bật GPS hoặc chọn điểm đi' : ''
      return
    }
    const mode = settings.value.travelMode
    const seq = ++planSeq
    nav.value.loading = true
    nav.value.error = ''
    const coords = `${o[0]},${o[1]};${d.lon},${d.lat}`
    if (!from) {
      nav.value.modeRoutes = {}
      prefetchOtherModes(coords, mode, seq)
    }
    try {
      const routes = await $fetch<RouteResult[]>('/api/route', {
        query: { coords, mode, alternatives: from ? '0' : '1', heading: heading == null ? undefined : Math.round(heading) },
      })
      if (seq !== planSeq) return
      nav.value.routes = routes
      nav.value.modeRoutes[mode] = routes
      nav.value.selected = 0
      nav.value.offlineRoute = false
      if (from && nav.value.active) {
        // rerouted while navigating: the new route's steps are numbered from 1 again
        spoken.clear()
        lastPrefetchStep = -1
        offCount = 0
      }
      saveOffline()
      // cameras / toll booths load in the background – the new route is usable right away
      // (Overpass can take tens of seconds, and must not hold up the next reroute)
      loadPois()
    } catch (e: any) {
      if (seq !== planSeq) return
      nav.value.modeRoutes[mode] = []
      nav.value.error = online.value ? (e?.data?.statusMessage ?? 'Không tìm được tuyến đường') : 'Mất kết nối mạng – không thể tìm tuyến mới'
    } finally {
      if (seq === planSeq) nav.value.loading = false
    }
  }

  /** Durations for the other travel-mode tabs, so switching mode is instant. */
  function prefetchOtherModes(coords: string, current: TravelMode, seq: number) {
    for (const { mode } of TRAVEL_MODES) {
      if (mode === current) continue
      $fetch<RouteResult[]>('/api/route', { query: { coords, mode, alternatives: '1' } })
        .catch(() => [])
        .then((routes) => { if (seq === planSeq) nav.value.modeRoutes[mode] = routes })
    }
  }

  async function setMode(mode: TravelMode) {
    if (nav.value.active || settings.value.travelMode === mode) return
    settings.value.travelMode = mode
    const routes = nav.value.modeRoutes[mode]
    if (!routes?.length) {
      nav.value.routes = []
      return plan()
    }
    nav.value.routes = routes
    nav.value.selected = 0
    nav.value.error = ''
    nav.value.offlineRoute = false
    saveOffline()
    await loadPois()
  }

  async function selectRoute(i: number) {
    nav.value.selected = i
    saveOffline()
    await loadPois()
  }

  async function loadPois() {
    const r = route.value
    if (!r) return
    if (!isMotorized(r.mode ?? 'car')) {
      // cameras, speed limits and tolls don't apply on foot or by bicycle
      nav.value.pois = []
      nav.value.tolls = []
      nav.value.poisError = false
      nav.value.poisLoading = false
      return
    }
    nav.value.poisLoading = true
    // expressway fees only need the route itself – show them without waiting for Overpass
    await loadExpressways()
    if (r !== route.value) return
    nav.value.pois = []
    applyPois(r, { pois: [], tolls: [] })
    try {
      const res = await $fetch<PoisResponse>('/api/pois', {
        method: 'POST',
        body: { line: r.geometry },
      })
      if (r !== route.value) return
      applyPois(r, res)
      nav.value.poisError = false
      try { localStorage.setItem('dlimap:offlinePois', JSON.stringify(res)) } catch {}
    } catch {
      nav.value.poisError = true
    } finally {
      nav.value.poisLoading = false
    }
  }

  function applyPois(r: RouteResult, res: PoisResponse) {
    const cum = routeCum(r)
    const vc = settings.value.vehicleClass
    nav.value.pois = res.pois
      .map((p) => {
        const s = snapToLine([p.lon, p.lat], r.geometry, cum)
        return { ...p, along: s.along, _d: s.dist }
      })
      .filter((p) => p._d < (p.line ? 40 : 70) && (!p.line || followsRoute(p.line, r.geometry, cum)))
      .map(({ _d, ...p }) => p)
      .sort((a, b) => a.along - b.along)
    const closed = expresswaySegments(r, cum, expressways, vc)
    // booths at entries/exits of a closed-system expressway are covered by its per-km fee
    const onExpressway = (along: number) => closed.some((c) => along > c.along - 300 && along < c.along + c.km! * 1000 + 300)
    const open: AlongToll[] = res.tolls
      .map((t) => ({ t, s: snapToLine([t.lon, t.lat], r.geometry, cum) }))
      .filter(({ s }) => s.dist < 80 && !onExpressway(s.along))
      .map(({ t, s }): AlongToll => ({
        id: t.id, name: t.name, kind: 'open', lat: t.lat, lon: t.lon, along: s.along,
        prices: t.prices, price: t.prices?.[vc] ?? null, source: t.source,
      }))
      .sort((a, b) => a.along - b.along)
      // a booth often has one node per direction / lane: keep one per 500 m
      .filter((t, i, arr) => i === 0 || t.along - arr[i - 1]!.along > 500)
    // motorbikes don't pay BOT fees and can't enter expressways
    nav.value.tolls = (r.mode ?? 'car') === 'car' ? [...open, ...closed].sort((a, b) => a.along - b.along) : []
  }

  // reprice tolls when vehicle class changes
  watch(() => settings.value.vehicleClass, (vc) => {
    for (const t of nav.value.tolls) t.price = priceOf(t, vc)
  })

  function saveOffline() {
    try {
      localStorage.setItem('dlimap:offlineRoute', JSON.stringify({
        destination: nav.value.destination,
        route: route.value,
        savedAt: Date.now(),
      }))
    } catch {}
  }

  /** Restore the last route from localStorage (hybrid / offline navigation). */
  function restoreOffline(): boolean {
    try {
      const raw = localStorage.getItem('dlimap:offlineRoute')
      if (!raw) return false
      const { destination, route } = JSON.parse(raw)
      if (!route) return false
      nav.value.destination = destination
      nav.value.routes = [route]
      nav.value.modeRoutes = {}
      nav.value.selected = 0
      nav.value.offlineRoute = true
      if (route.mode) settings.value.travelMode = route.mode
      const pois = localStorage.getItem('dlimap:offlinePois')
      try { expressways = JSON.parse(localStorage.getItem('dlimap:expressways') ?? '[]') } catch {}
      applyPois(nav.value.routes[0]!, pois ? JSON.parse(pois) : { pois: [], tolls: [] })
      return true
    } catch {
      return false
    }
  }

  function start(simulate = false) {
    if (!route.value) return
    nav.value.active = true
    nav.value.progress = null
    offCount = 0
    spoken.clear()
    lastPrefetchStep = -1
    say('Xuất phát', 'start', 0)
    prefetch(route.value.steps.slice(1, 6).flatMap((st) => PROMPT_DISTANCES.map((th) => promptText(st.instruction, th))))
    if (simulate) startSim()
  }

  function stop() {
    nav.value.active = false
    nav.value.progress = null
    stopSim()
  }

  function clear() {
    stop()
    planSeq++
    nav.value.routes = []
    nav.value.modeRoutes = {}
    nav.value.pois = []
    nav.value.tolls = []
    nav.value.destination = null
    nav.value.error = ''
  }

  // ---------- simulation ----------
  function startSim() {
    const r = route.value
    if (!r) return
    stopSim()
    nav.value.simulating = true
    const cum = routeCum(r)
    let d = 0
    let drift = 0
    let speed = 0
    simTimer = setInterval(() => {
      const total = cum[cum.length - 1]!
      const { index } = pointAlong(r.geometry, cum, d)
      const typical = r.segmentSpeeds[index] ?? 40
      // random walk around the road's typical speed; occasionally exceeds the limit so warnings can be seen
      drift = Math.max(-0.15, Math.min(0.3, drift + (Math.random() - 0.48) * 0.04))
      const target = Math.max(8, typical * (1 + drift))
      speed += (target - speed) * 0.25
      d += (speed / 3.6) * 0.5 * nav.value.simFactor
      if (d >= total) {
        d = total
        stopSim()
      }
      const a = pointAlong(r.geometry, cum, d)
      const b = pointAlong(r.geometry, cum, Math.min(total, d + 15))
      const h = haversine(a.point, b.point) > 1 ? bearing(a.point, b.point) : pos.value.heading
      setSimulated(a.point, speed, h)
    }, 500)
  }

  function stopSim() {
    if (simTimer) clearInterval(simTimer)
    simTimer = null
    if (nav.value.simulating) {
      nav.value.simulating = false
      endSimulation()
    }
  }

  // ---------- progress tracking ----------
  watch(() => pos.value.lngLat, (p) => {
    const r = route.value
    if (!p || !nav.value.active || !r) return
    const cum = routeCum(r)
    const prev = nav.value.progress
    const snap = prev && !prev.offRoute
      ? snapToLine(p, r.geometry, cum, Math.max(0, prev.index - 5), 300)
      : snapToLine(p, r.geometry, cum)

    // off the route: further than 50 m, or than the GPS error when it is poor (under flyovers,
    // between tall buildings), so a bad fix doesn't trigger reroutes while still on the route
    const tolerance = Math.min(120, Math.max(50, pos.value.accuracy * 1.5))
    offCount = snap.dist > tolerance ? offCount + 1 : 0
    const offRoute = offCount >= 3

    let stepIdx = 0
    for (let i = 0; i < r.steps.length; i++) if (r.steps[i]!.geomIndex <= snap.index) stepIdx = i
    const next = r.steps[stepIdx + 1]
    const distToStep = next ? Math.max(0, cum[next.geomIndex]! - snap.along) : 0
    const total = cum[cum.length - 1]!
    const remaining = Math.max(0, total - snap.along)
    const ratio = total ? remaining / total : 0

    nav.value.progress = {
      along: snap.along, index: snap.index, point: snap.point, offRoute, stepIdx, distToStep, remaining,
      // OSRM typical time + real-time congestion delay (TomTom), both pro-rated to what's left
      remainingTime: (r.duration + (routeTraffic.value?.delay ?? 0)) * ratio,
    }

    if (next) {
      // Announce early enough to finish speaking before the turn: lead = ~3 s of travel
      // at the real ground speed (×simFactor while simulating).
      const mps = (pos.value.speed / 3.6) * (nav.value.simulating ? nav.value.simFactor : 1)
      const lead = mps * 3
      for (const th of PROMPT_DISTANCES) {
        const key = `${stepIdx + 1}:${th}`
        if (distToStep <= th + lead && distToStep > th / 3 && !spoken.has(key)) {
          // skip prompts for thresholds we've already passed (e.g. 1 km prompt when 250 m away)
          for (const t of PROMPT_DISTANCES) if (t >= th) spoken.add(`${stepIdx + 1}:${t}`)
          say(promptText(next.instruction, th), key, 0, { ttlMs: 4000, channel: 'nav' })
          break
        }
      }
    }
    if (stepIdx !== lastPrefetchStep) {
      lastPrefetchStep = stepIdx
      prefetch(r.steps.slice(stepIdx + 1, stepIdx + 6).flatMap((st) => PROMPT_DISTANCES.map((th) => promptText(st.instruction, th))))
    }

    if (remaining < 30) {
      say('Bạn đã đến nơi', 'arrive', 0)
      stop()
      return
    }

    if (offRoute && !nav.value.loading && !nav.value.simulating && Date.now() - lastReroute > 15_000) {
      lastReroute = Date.now()
      if (online.value) {
        say('Đang tìm lại đường', 'reroute', 10_000)
        // keep going the way the vehicle is moving instead of being told to U-turn
        plan(p, pos.value.speed > 5 ? pos.value.heading : undefined)
      } else {
        say('Bạn đã đi lệch tuyến. Mất kết nối, tiếp tục theo tuyến đã lưu', 'offline-off', 60_000)
      }
    }
  })

  return { nav, route, tollTotal, tollUnknown, plan, setMode, selectRoute, start, stop, clear, startSim, stopSim, restoreOffline }
}

let instance: ReturnType<typeof createNavigation> | undefined

/** Navigation state + engine (singleton so watchers are registered once). */
export function useNavigation() {
  return (instance ??= effectScope(true).run(createNavigation)!)
}

export function useOnline() {
  const online = useState('online', () => navigator.onLine)
  if (!import.meta.server && !(window as any).__dlimapOnline) {
    ;(window as any).__dlimapOnline = true
    window.addEventListener('online', () => (online.value = true))
    window.addEventListener('offline', () => (online.value = false))
  }
  return online
}

/** A ticking clock (1 s) shared by countdowns and time-based estimates. */
export function useClock() {
  const now = useState('clock', () => Date.now())
  if (!(window as any).__dlimapClock) {
    ;(window as any).__dlimapClock = setInterval(() => (now.value = Date.now()), 1000)
  }
  return now
}
