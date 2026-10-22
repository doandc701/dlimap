import type { Map as MlMap } from 'maplibre-gl'
import type { LngLat } from '#shared/types'

const map = shallowRef<MlMap | null>(null)

export function useMap() {
  const follow = useState('follow', () => true)
  const pickMode = useState<null | 'origin' | 'destination'>('pickMode', () => null)

  function fitLine(line: LngLat[], padding = 80) {
    if (!map.value || line.length < 2) return
    const [w, s, e, n] = bbox(line)
    follow.value = false
    map.value.fitBounds([[w, s], [e, n]], { padding: { top: padding + 70, bottom: padding + 160, left: padding, right: padding }, duration: 800, pitch: 0, bearing: 0 })
  }

  return { map, follow, pickMode, fitLine }
}

/** What the user tapped on the map (shown in PlaceCard). */
export type MapSelection =
  | { kind: 'place'; name: string; category?: string; lat: number; lon: number }
  | { kind: 'report'; id: string; lat: number; lon: number }
  | { kind: 'poi'; poiKind: string; title: string; name?: string; lat: number; lon: number }
  | { kind: 'toll'; id: string; lat: number; lon: number }

export function useSelection() {
  return useState<MapSelection | null>('selection', () => null)
}
