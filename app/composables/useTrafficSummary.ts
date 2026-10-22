import type { Map as MlMap, MapGeoJSONFeature } from 'maplibre-gl'
import type { LngLat, RouteResult } from '#shared/types'

export interface AreaTraffic {
  /** length-weighted mean of current / free-flow speed (0..1) */
  ratio: number
  /** share of road length moving below half its free-flow speed */
  jammedShare: number
  level: 0 | 1 | 2 | 3
}

export interface RouteTraffic {
  /** extra seconds caused by congestion on the visible part of the route */
  delay: number
  /** km of the route moving below half of free-flow speed */
  jammedKm: number
  /** share of route samples that had traffic data */
  coverage: number
}

export const AREA_TEXT = [
  ['Giao thông thông thoáng ở khu này', 'Xe chạy bình thường'],
  ['Giao thông hơi đông ở khu này', 'Chậm hơn bình thường một chút'],
  ['Giao thông đông đúc ở khu này', 'Chậm hơn bình thường nhiều'],
  ['Ùn tắc nghiêm trọng ở khu này', 'Xe di chuyển rất chậm'],
] as const

function lineLength(f: MapGeoJSONFeature): number {
  const g = f.geometry
  const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []
  let len = 0
  for (const l of lines) for (let i = 1; i < l.length; i++) len += haversine(l[i - 1] as LngLat, l[i] as LngLat)
  return len
}

/**
 * Summaries computed from the real-time TomTom flow tiles currently rendered on
 * the map (`traffic` layer, property traffic_level = current / free-flow speed).
 */
function createTrafficSummary() {
  const area = useState<AreaTraffic | null>('areaTraffic', () => null)
  const routeTraffic = useState<RouteTraffic | null>('routeTraffic', () => null)
  const { nav, route } = useNavigation()
  /** congestion delay (s) of every alternative route, by index */
  const routeDelays = useState<number[]>('routeDelays', () => [])

  function areaOf(m: MlMap) {
    if (!m.getLayer('traffic') || m.getLayoutProperty('traffic', 'visibility') === 'none' || m.getZoom() < 11) {
      area.value = null
      return
    }
    let total = 0, sum = 0, jammed = 0
    for (const f of m.queryRenderedFeatures({ layers: ['traffic'] })) {
      const lvl = Number(f.properties.traffic_level)
      if (!Number.isFinite(lvl)) continue
      const len = lineLength(f)
      total += len
      sum += lvl * len
      if (lvl < 0.5) jammed += len
    }
    // need some road length on screen for a meaningful summary (≈ a few blocks when zoomed in)
    if (total < 800) {
      area.value = null
      return
    }
    const ratio = sum / total
    const jammedShare = jammed / total
    const level = ratio >= 0.85 && jammedShare < 0.08 ? 0 : ratio >= 0.72 ? 1 : ratio >= 0.55 ? 2 : 3
    area.value = { ratio, jammedShare, level }
  }

  /** Congestion along one route, sampled on the traffic tiles currently rendered. */
  function trafficOf(m: MlMap, r: RouteResult): RouteTraffic | null {
    const cum = routeCum(r)
    const total = cum[cum.length - 1]!
    const step = Math.max(150, total / 400)
    const bounds = m.getBounds()
    let samples = 0, covered = 0, delay = 0, jammed = 0
    for (let d = step / 2; d < total; d += step) {
      const { point, index } = pointAlong(r.geometry, cum, d)
      if (!bounds.contains(point)) continue
      samples++
      const px = m.project(point)
      const feats = m.queryRenderedFeatures([[px.x - 4, px.y - 4], [px.x + 4, px.y + 4]], { layers: ['traffic'] })
      // at junctions a crossing street may also be under the sample – take the freest
      // value so a jammed side street doesn't count against the route
      const lvl = Math.max(...feats.map((f) => Number(f.properties.traffic_level)).filter(Number.isFinite), -1)
      if (lvl < 0) continue
      covered++
      const free = (r.segmentSpeeds[index] || 40) / 3.6
      delay += (step / free) * (1 / Math.max(0.1, lvl) - 1)
      if (lvl < 0.5) jammed += step / 1000
    }
    return samples && covered / samples > 0.3 ? { delay, jammedKm: jammed, coverage: covered / samples } : null
  }

  function routeOf(m: MlMap) {
    const r = route.value
    // congestion only slows motor vehicles – walking / cycling times stay as routed
    if (!r || !isMotorized(r.mode ?? 'car') || !m.getLayer('traffic') || m.getLayoutProperty('traffic', 'visibility') === 'none') {
      routeTraffic.value = null
      routeDelays.value = []
      return
    }
    routeTraffic.value = trafficOf(m, r)
    // alternatives too, so their times are compared on equal terms
    routeDelays.value = nav.value.routes.map((x) => (x === r ? routeTraffic.value : trafficOf(m, x))?.delay ?? 0)
  }

  function update(m: MlMap) {
    areaOf(m)
    routeOf(m)
  }

  return { area, routeTraffic, routeDelays, update }
}

let instance: ReturnType<typeof createTrafficSummary> | undefined
export function useTrafficSummary() {
  return (instance ??= effectScope(true).run(createTrafficSummary)!)
}
