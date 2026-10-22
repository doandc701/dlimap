import type { TravelMode, VehicleClass } from '#shared/types'
import type { SpeedClass } from '#shared/utils/rules'

export interface Settings {
  vehicleClass: VehicleClass
  /** vehicle group for speed limits (TT 38/2024) */
  speedClass: SpeedClass
  /** km/h over the limit before warning */
  tolerance: number
  voice: boolean
  /** auto = browser vi-VN voice if installed, else server TTS */
  voiceEngine: 'auto' | 'browser' | 'server'
  theme: 'auto' | 'light' | 'dark'
  travelMode: TravelMode
  showTraffic: boolean
  showSignals: boolean
  nickname: string
  color: string
}

export const VEHICLE_CLASS_LABEL: Record<VehicleClass, string> = {
  1: 'Loại 1 – Xe dưới 12 ghế, tải dưới 2 tấn',
  2: 'Loại 2 – Xe 12–30 ghế, tải 2 đến dưới 4 tấn',
  3: 'Loại 3 – Xe 31 ghế trở lên, tải 4 đến dưới 10 tấn',
  4: 'Loại 4 – Tải 10 đến dưới 18 tấn, container 20 ft',
  5: 'Loại 5 – Tải từ 18 tấn, container 40 ft',
}

export const SPEED_CLASS_LABEL: Record<SpeedClass, string> = {
  car: 'Ô tô ≤ 28 chỗ, tải ≤ 3,5 tấn',
  heavy: 'Ô tô > 28 chỗ, tải > 3,5 tấn',
  bus: 'Xe buýt, đầu kéo sơ mi rơ moóc, mô tô, xe chuyên dùng',
  tow: 'Xe kéo rơ moóc / kéo xe khác, xe trộn bê tông, xe xi téc',
  moped: 'Xe gắn máy (tối đa 40 km/h)',
}

export const TRAVEL_MODES: { mode: TravelMode; icon: IconName; label: string }[] = [
  { mode: 'car', icon: 'car', label: 'Ô tô' },
  { mode: 'motorbike', icon: 'motorbike', label: 'Xe máy' },
  { mode: 'bike', icon: 'bike', label: 'Xe đạp' },
  { mode: 'foot', icon: 'foot', label: 'Đi bộ' },
]

/** Speed limits, cameras and tolls only concern motor vehicles. */
export const isMotorized = (m: TravelMode) => m === 'car' || m === 'motorbike'

/** On a motorbike the TT 38/2024 limits are those of "mô tô" (or "xe gắn máy" if chosen). */
export function effectiveSpeedClass(s: Settings): SpeedClass {
  return s.travelMode === 'motorbike' && s.speedClass !== 'moped' ? 'bus' : s.speedClass
}

export function useSettings() {
  return usePersisted<Settings>('settings', () => ({
    vehicleClass: 1,
    speedClass: 'car',
    tolerance: 3,
    voice: true,
    voiceEngine: 'auto',
    theme: 'auto',
    travelMode: 'car',
    showTraffic: true,
    showSignals: true,
    nickname: 'Tài xế',
    color: '#0b5fff',
  }))
}

export function useIsDark() {
  const s = useSettings()
  const media = useState('prefersDark', () => window.matchMedia('(prefers-color-scheme: dark)').matches)
  onMounted(() => {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => (media.value = e.matches))
  })
  return computed(() => (s.value.theme === 'auto' ? media.value : s.value.theme === 'dark'))
}
