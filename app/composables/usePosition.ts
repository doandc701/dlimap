import type { LngLat } from '#shared/types'

export interface PositionState {
  lngLat: LngLat | null
  /** km/h */
  speed: number
  heading: number
  accuracy: number
  source: 'gps' | 'sim' | null
  error: string
}

let watchId: number | null = null
let last: { p: LngLat; t: number } | null = null

export function usePosition() {
  const pos = useState<PositionState>('position', () => ({
    lngLat: null, speed: 0, heading: 0, accuracy: 0, source: null, error: '',
  }))

  function startGps() {
    if (watchId != null || !('geolocation' in navigator)) {
      if (!('geolocation' in navigator)) pos.value.error = 'Trình duyệt không hỗ trợ định vị'
      return
    }
    watchId = navigator.geolocation.watchPosition(
      (g) => {
        if (pos.value.source === 'sim') return
        const p: LngLat = [g.coords.longitude, g.coords.latitude]
        const now = g.timestamp
        let speed = g.coords.speed != null ? g.coords.speed * 3.6 : NaN
        let heading = g.coords.heading ?? NaN
        if (last) {
          const d = haversine(last.p, p)
          const dt = (now - last.t) / 1000
          if (Number.isNaN(speed) && dt > 0) speed = (d / dt) * 3.6
          if (Number.isNaN(heading) && d > 3) heading = bearing(last.p, p)
        }
        last = { p, t: now }
        pos.value = {
          lngLat: p,
          speed: Number.isFinite(speed) ? Math.max(0, speed) : 0,
          heading: Number.isFinite(heading) ? heading : pos.value.heading,
          accuracy: g.coords.accuracy,
          source: 'gps',
          error: '',
        }
      },
      (e) => {
        pos.value.error = e.code === 1 ? 'Chưa cấp quyền vị trí' : 'Không lấy được vị trí GPS'
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )
  }

  function setSimulated(p: LngLat, speed: number, heading: number) {
    pos.value = { lngLat: p, speed, heading, accuracy: 5, source: 'sim', error: '' }
  }

  function endSimulation() {
    if (pos.value.source === 'sim') pos.value.source = null
    last = null
  }

  return { pos, startGps, setSimulated, endSimulation }
}
