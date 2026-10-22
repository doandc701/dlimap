import type { LngLat, RouteResult, RouteStep, TravelMode } from '#shared/types'

const MOD: Record<string, string> = {
  'uturn': 'quay đầu',
  'sharp right': 'rẽ gắt sang phải',
  'right': 'rẽ phải',
  'slight right': 'chếch sang phải',
  'straight': 'đi thẳng',
  'slight left': 'chếch sang trái',
  'left': 'rẽ trái',
  'sharp left': 'rẽ gắt sang trái',
}

interface OsrmStep {
  name: string
  ref?: string
  distance: number
  duration: number
  geometry: { coordinates: LngLat[] }
  maneuver: { type: string; modifier?: string; location: LngLat; exit?: number }
}

function instruction(s: OsrmStep): string {
  const road = s.ref && s.name ? `${s.name} (${s.ref})` : s.name || s.ref || ''
  const onto = road ? ` vào ${road}` : ''
  const mod = MOD[s.maneuver.modifier ?? ''] ?? 'tiếp tục'
  switch (s.maneuver.type) {
    case 'depart': return `Xuất phát${road ? ` trên ${road}` : ''}`
    case 'arrive': return 'Bạn đã đến nơi'
    case 'roundabout':
    case 'rotary':
      return `Vào vòng xuyến, đi theo lối ra thứ ${s.maneuver.exit ?? 1}${onto}`
    case 'exit roundabout':
    case 'exit rotary':
      return `Ra khỏi vòng xuyến${onto}`
    case 'on ramp': return `Đi vào đường nhánh${onto}`
    case 'off ramp': return `Rẽ ra lối thoát${onto}`
    case 'fork': return `Tại ngã ba, ${mod}${onto}`
    case 'merge': return `Nhập làn${onto}`
    case 'end of road': return `Cuối đường, ${mod}${onto}`
    case 'new name':
    case 'continue':
      return s.maneuver.modifier && s.maneuver.modifier !== 'straight' ? `${mod[0]!.toUpperCase()}${mod.slice(1)}${onto}` : `Tiếp tục${onto}`
    default:
      return `${mod[0]!.toUpperCase()}${mod.slice(1)}${onto}`
  }
}

function fromOsrm(r: any, mode: TravelMode): RouteResult {
  const geometry: LngLat[] = r.geometry.coordinates
  const steps: RouteStep[] = []
  let gi = 0
  for (const leg of r.legs) {
    for (const s of leg.steps as OsrmStep[]) {
      steps.push({
        instruction: instruction(s),
        maneuver: s.maneuver.type,
        modifier: s.maneuver.modifier,
        name: s.name || s.ref || '',
        ref: s.ref,
        distance: s.distance,
        duration: s.duration,
        location: s.maneuver.location,
        geomIndex: gi,
      })
      gi += Math.max(0, s.geometry.coordinates.length - 1)
    }
  }
  const segmentSpeeds: number[] = r.legs.flatMap((l: any) => (l.annotation?.speed ?? []).map((v: number) => Math.round(v * 3.6)))
  return { mode, geometry, distance: r.distance, duration: r.duration, steps, segmentSpeeds }
}

async function osrm(base: string, coords: string, alternatives: boolean, mode: TravelMode): Promise<RouteResult[]> {
  // routing.openstreetmap.de serves each profile under its own base path, always named "driving"
  const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&annotations=speed&alternatives=${alternatives}`
  const data = await cached(`route:${url}`, 10 * 60_000, () =>
    $fetch<{ code: string; routes: any[] }>(url, { timeout: 30000, retry: 2, retryDelay: 400 }),
  )
  if (data.code !== 'Ok' || !data.routes?.length) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tuyến đường' })
  return data.routes.map((r) => fromOsrm(r, mode))
}

/** Google encoded polyline with 6-digit precision (Valhalla). */
function decodePolyline6(str: string): LngLat[] {
  const out: LngLat[] = []
  let i = 0, lat = 0, lon = 0
  const next = () => {
    let shift = 0, result = 0, b: number
    do {
      b = str.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (i < str.length) {
    lat += next()
    lon += next()
    out.push([lon / 1e6, lat / 1e6])
  }
  return out
}

/** Valhalla maneuver type → OSRM maneuver type + modifier, so both share the Vietnamese wording. */
const VALHALLA_MANEUVER: Record<number, [string, string?]> = {
  1: ['depart'], 2: ['depart', 'right'], 3: ['depart', 'left'],
  4: ['arrive'], 5: ['arrive', 'right'], 6: ['arrive', 'left'],
  7: ['new name', 'straight'], 8: ['continue', 'straight'],
  9: ['turn', 'slight right'], 10: ['turn', 'right'], 11: ['turn', 'sharp right'],
  12: ['turn', 'uturn'], 13: ['turn', 'uturn'],
  14: ['turn', 'sharp left'], 15: ['turn', 'left'], 16: ['turn', 'slight left'],
  17: ['on ramp', 'straight'], 18: ['on ramp', 'right'], 19: ['on ramp', 'left'],
  20: ['off ramp', 'right'], 21: ['off ramp', 'left'],
  22: ['fork', 'straight'], 23: ['fork', 'slight right'], 24: ['fork', 'slight left'],
  25: ['merge', 'straight'], 37: ['merge', 'slight right'], 38: ['merge', 'slight left'],
  26: ['roundabout'], 27: ['exit roundabout'],
}

interface ValhallaManeuver {
  type: number
  street_names?: string[]
  length: number
  time: number
  begin_shape_index: number
  end_shape_index: number
  roundabout_exit_count?: number
}

function fromValhalla(trip: any, mode: TravelMode): RouteResult {
  const geometry: LngLat[] = []
  const steps: RouteStep[] = []
  const segmentSpeeds: number[] = []
  for (const leg of trip.legs) {
    // consecutive legs share their joining point
    const offset = geometry.length ? geometry.length - 1 : 0
    const shape = decodePolyline6(leg.shape)
    geometry.push(...(offset ? shape.slice(1) : shape))
    for (const m of leg.maneuvers as ValhallaManeuver[]) {
      const [type, modifier] = VALHALLA_MANEUVER[m.type] ?? ['continue', 'straight']
      const location = shape[m.begin_shape_index] ?? shape[0]!
      const [name = '', ref] = m.street_names ?? []
      const osrmLike: OsrmStep = {
        name, ref, distance: m.length * 1000, duration: m.time,
        geometry: { coordinates: [] }, maneuver: { type, modifier, location, exit: m.roundabout_exit_count },
      }
      steps.push({
        instruction: instruction(osrmLike), maneuver: type, modifier, name: name || ref || '', ref,
        distance: m.length * 1000, duration: m.time, location, geomIndex: offset + m.begin_shape_index,
      })
      const kmh = m.time > 0 ? Math.round((m.length / m.time) * 3600) : 0
      for (let k = m.begin_shape_index; k < m.end_shape_index; k++) segmentSpeeds[offset + k] = kmh
    }
  }
  return { mode, geometry, distance: trip.summary.length * 1000, duration: trip.summary.time, steps, segmentSpeeds }
}

async function valhalla(base: string, coords: string, alternatives: boolean, mode: TravelMode): Promise<RouteResult[]> {
  const body = {
    locations: coords.split(';').map((c) => { const [lon, lat] = c.split(',').map(Number); return { lon, lat } }),
    costing: 'motorcycle',
    alternates: alternatives ? 2 : 0,
    units: 'kilometers',
  }
  const data = await cached(`route:valhalla:${JSON.stringify(body)}`, 10 * 60_000, () =>
    $fetch<{ trip: any; alternates?: { trip: any }[] }>(`${base}/route`, { method: 'POST', body, timeout: 30000, retry: 2, retryDelay: 400 }),
  ).catch((e) => {
    throw createError({ statusCode: 404, statusMessage: e?.data?.error ?? 'Không tìm thấy tuyến đường' })
  })
  return [data.trip, ...(data.alternates ?? []).map((a) => a.trip)].map((t) => fromValhalla(t, mode))
}

const MODES: TravelMode[] = ['car', 'motorbike', 'bike', 'foot']

export default defineEventHandler(async (event) => {
  const { coords, alternatives, mode = 'car' } = getQuery(event) as { coords?: string; alternatives?: string; mode?: TravelMode }
  if (!coords || !/^[-\d.,;]+$/.test(coords)) throw createError({ statusCode: 400, statusMessage: 'coords không hợp lệ' })
  if (!MODES.includes(mode)) throw createError({ statusCode: 400, statusMessage: 'mode không hợp lệ' })

  const cfg = useRuntimeConfig()
  const alt = alternatives === '1'
  switch (mode) {
    case 'motorbike': return valhalla(cfg.valhallaUrl, coords, alt, mode)
    case 'bike': return osrm(cfg.osrmBikeUrl, coords, alt, mode)
    case 'foot': return osrm(cfg.osrmFootUrl, coords, alt, mode)
    default: return osrm(cfg.osrmUrl, coords, alt, mode)
  }
})
