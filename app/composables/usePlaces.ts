import type { LngLat, NearbyCategory, NearbyPlace } from '#shared/types'
import type { Place } from './useNavigation'

export const NEARBY_CATEGORIES: { id: NearbyCategory; icon: IconName; label: string }[] = [
  { id: 'restaurant', icon: 'restaurant', label: 'Nhà hàng' },
  { id: 'cafe', icon: 'cafe', label: 'Cà phê' },
  { id: 'hotel', icon: 'hotel', label: 'Khách sạn' },
  { id: 'attraction', icon: 'attraction', label: 'Điểm tham quan' },
  { id: 'transit', icon: 'transit', label: 'Phương tiện công cộng' },
  { id: 'parking', icon: 'parking', label: 'Bãi đỗ xe' },
  { id: 'fuel', icon: 'fuel', label: 'Cây xăng' },
  { id: 'pharmacy', icon: 'pharmacy', label: 'Hiệu thuốc' },
  { id: 'atm', icon: 'atm', label: 'ATM / Ngân hàng' },
  { id: 'hospital', icon: 'hospital', label: 'Bệnh viện' },
]

/** Places the user saved ("Lưu"), kept on this device. */
export function useSavedPlaces() {
  const saved = usePersisted<{ items: Place[] }>('savedPlaces', () => ({ items: [] }))
  const key = (p: { lat: number; lon: number }) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`
  const isSaved = (p: { lat: number; lon: number }) => saved.value.items.some((x) => key(x) === key(p))
  function toggle(p: Place) {
    saved.value.items = isSaved(p) ? saved.value.items.filter((x) => key(x) !== key(p)) : [p, ...saved.value.items].slice(0, 100)
  }
  return { saved, isSaved, toggle }
}

/** Category search around a point ("Nhà hàng", "Cây xăng"… chips and "Gần đó"). */
export function useNearby() {
  const state = useState('nearby', () => ({
    category: null as NearbyCategory | null,
    center: null as LngLat | null,
    items: [] as NearbyPlace[],
    loading: false,
    error: '',
  }))

  async function search(category: NearbyCategory, center: LngLat) {
    state.value = { category, center, items: [], loading: true, error: '' }
    try {
      const items = await $fetch<NearbyPlace[]>('/api/nearby', { query: { cat: category, lat: center[1], lon: center[0], r: 1500 } })
      if (state.value.category === category) state.value.items = items
    } catch {
      if (state.value.category === category) state.value.error = 'Không tải được kết quả – thử lại sau'
    } finally {
      if (state.value.category === category) state.value.loading = false
    }
  }

  function clear() {
    state.value = { category: null, center: null, items: [], loading: false, error: '' }
  }

  return { state, search, clear }
}
