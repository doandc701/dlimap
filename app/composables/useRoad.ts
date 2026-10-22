import type { LngLat, Poi, RoadInfo, RoadRun, RouteResult } from '#shared/types'

export interface Report {
  id: string
  type: 'camera' | 'police' | 'accident' | 'jam' | 'hazard'
  lat: number
  lon: number
  note: string
  createdAt: number
  expiresAt: number
  goneVotes: number
  ownerless?: boolean
}

const SLICE = 40_000

/** Residential guess for a route segment when no live area lookup is available. */
function guessResidential(run: RoadRun, freeFlow: number | undefined): boolean {
  if (['residential', 'living_street', 'service', 'unclassified'].includes(run.highway)) return true
  if (['motorway', 'motorway_link', 'trunk'].includes(run.highway)) return false
  return (freeFlow ?? 60) <= 50
}

function createRoad() {
  const { pos } = usePosition()
  const { nav, route } = useNavigation()
  const online = useOnline()
  const settings = useSettings()

  /** last answer of /api/road and where it was asked */
  const live = useState<RoadInfo | null>('roadLive', () => null)
  const liveAt = shallowRef<LngLat | null>(null)
  /** road attributes along the current route (absolute segment indices) */
  const runs = shallowRef<RoadRun[]>([])
  let runsRoute: RouteResult | null = null
  let loadedUntil = 0
  let runsBusy = false

  const road = computed<RoadInfo | null>(() => {
    const p = pos.value.lngLat
    const liveFresh = !!(p && liveAt.value && haversine(p, liveAt.value) < 400)
    const prog = nav.value.progress
    const r = route.value
    if (nav.value.active && prog && !prog.offRoute && r) {
      const run = runs.value.find((x) => prog.index >= x.from && prog.index < x.to)
      if (run) {
        const residential = liveFresh && live.value ? live.value.residential : guessResidential(run, r.segmentSpeeds[prog.index])
        return {
          name: run.name, ref: run.ref, highway: run.highway,
          maxspeed: limitFor(run.maxspeed, run.highway, residential, run.divided, effectiveSpeedClass(settings.value)),
          maxspeedSource: run.maxspeed ? 'osm' : 'rule',
          osmMaxspeed: run.maxspeed, divided: run.divided,
          residential, tunnel: run.tunnel, noOvertaking: run.noOvertaking,
        }
      }
    }
    const l = liveFresh ? live.value : null
    return l && { ...l, maxspeed: limitFor(l.osmMaxspeed, l.highway ?? '', l.residential, l.divided, effectiveSpeedClass(settings.value)) }
  })

  async function loadRuns() {
    const r = route.value
    if (!r || runsBusy || loadedUntil >= r.geometry.length - 1) return
    runsBusy = true
    const cum = routeCum(r)
    const start = loadedUntil
    let end = start + 1
    while (end < r.geometry.length - 1 && cum[end]! - cum[start]! < SLICE && end - start < 2500) end++
    try {
      const res = await $fetch<RoadRun[]>('/api/roads', { method: 'POST', body: { line: r.geometry.slice(start, end + 1) } })
      if (r !== runsRoute) return
      runs.value = [...runs.value, ...res.map((x) => ({ ...x, from: x.from + start, to: x.to + start }))]
      loadedUntil = end
      try { localStorage.setItem('dlimap:offlineRoads', JSON.stringify({ distance: r.distance, until: loadedUntil, runs: runs.value })) } catch {}
    } catch {
      // retried on the next progress update
    } finally {
      runsBusy = false
    }
  }

  watch(route, (r) => {
    runsRoute = r
    runs.value = []
    loadedUntil = 0
    if (!r) return
    // restore road data saved with the offline route
    try {
      const saved = JSON.parse(localStorage.getItem('dlimap:offlineRoads') ?? 'null')
      if (saved && saved.distance === r.distance) {
        runs.value = saved.runs
        loadedUntil = saved.until
      }
    } catch {}
    loadRuns()
  }, { immediate: true })

  // keep ~15 km of road data ahead of the vehicle
  watch(() => nav.value.progress?.index, (idx) => {
    const r = route.value
    if (idx == null || !r || !online.value) return
    const cum = routeCum(r)
    if (cum[Math.min(loadedUntil, cum.length - 1)]! - cum[idx]! < 15_000) loadRuns()
  })
  const nearby = useState<Poi[]>('nearbyPois', () => [])
  const reports = useState<Report[]>('reports', () => [])

  let lastRoad: { p: LngLat; t: number } | null = null
  let lastNearby: LngLat | null = null
  let roadBusy = false
  let nearbyBusy = false

  async function refreshRoad(p: LngLat) {
    roadBusy = true
    try {
      live.value = await $fetch<RoadInfo | null>('/api/road', {
        query: { lat: p[1].toFixed(5), lon: p[0].toFixed(5), heading: Math.round(pos.value.heading) },
      })
      liveAt.value = p
      lastRoad = { p, t: Date.now() }
    } catch {
      lastRoad = { p, t: Date.now() } // back off on failures too
    } finally {
      roadBusy = false
    }
  }

  async function refreshNearby(p: LngLat) {
    nearbyBusy = true
    try {
      const res = await $fetch<{ pois: Poi[] }>('/api/pois', { method: 'POST', body: { center: p, radius: 3000 } })
      nearby.value = res.pois
      lastNearby = p
    } catch {
      lastNearby = p
    } finally {
      nearbyBusy = false
    }
  }

  async function loadReports() {
    try { reports.value = await $fetch<Report[]>('/api/reports') } catch {}
  }

  /** tokens of reports created on this device (lets the author delete them) */
  const mine = usePersisted<{ tokens: Record<string, string>; voted: string[] }>('myReports', () => ({ tokens: {}, voted: [] }))
  const groupSelf = usePersisted('groupSelf', () => ({ id: crypto.randomUUID(), code: '' }))

  async function report(type: Report['type'], note = '', at?: LngLat) {
    const p = at ?? pos.value.lngLat
    if (!p) throw new Error('Chưa có vị trí')
    const r = await $fetch<Report & { token: string }>('/api/reports', { method: 'POST', body: { type, lat: p[1], lon: p[0], note } })
    const { token, ...pub } = r
    mine.value.tokens[r.id] = token
    reports.value.push(pub)
  }

  const isMine = (id: string) => id in mine.value.tokens || !!reports.value.find((r) => r.id === id)?.ownerless

  async function removeReport(id: string) {
    await $fetch(`/api/reports/${id}`, { method: 'DELETE', query: { token: mine.value.tokens[id] } })
    reports.value = reports.value.filter((r) => r.id !== id)
    delete mine.value.tokens[id]
  }

  async function markGone(id: string) {
    const res = await $fetch<{ removed: boolean; votes?: number }>(`/api/reports/${id}/gone`, { method: 'POST', body: { voter: groupSelf.value.id } })
    mine.value.voted.push(id)
    if (res.removed) reports.value = reports.value.filter((r) => r.id !== id)
    else {
      const r = reports.value.find((x) => x.id === id)
      if (r) r.goneVotes = res.votes ?? r.goneVotes + 1
    }
  }

  watch(() => pos.value.lngLat, (p) => {
    if (!p || !online.value) return
    // live road lookup: every ~200 m (at most every 8 s, to stay polite with Overpass).
    // While navigating, road data comes from the route, so only refresh the residential flag every ~1 km.
    const moved = lastRoad ? haversine(lastRoad.p, p) : Infinity
    const age = lastRoad ? Date.now() - lastRoad.t : Infinity
    const step = nav.value.active && runs.value.length ? 1000 : 200
    if (!roadBusy && age > 8_000 && (moved > step || (age > 30_000 && moved > 15))) {
      refreshRoad(p)
    }
    // hazards around the vehicle when there is no route loaded
    if (!nav.value.routes.length && !nearbyBusy && (!lastNearby || haversine(lastNearby, p) > 1500)) {
      refreshNearby(p)
    }
  })

  loadReports()
  setInterval(loadReports, 60_000)
  // drop expired reports locally between refreshes
  setInterval(() => {
    const now = Date.now()
    if (reports.value.some((r) => r.expiresAt < now)) reports.value = reports.value.filter((r) => r.expiresAt >= now)
  }, 30_000)

  return { road, nearby, reports, report, loadReports, isMine, removeReport, markGone, hasVoted: (id: string) => mine.value.voted.includes(id) }
}

let instance: ReturnType<typeof createRoad> | undefined
export function useRoad() {
  return (instance ??= effectScope(true).run(createRoad)!)
}
