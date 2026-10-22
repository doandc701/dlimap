import type { LngLat } from '#shared/types'

const lon2tile = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2tile = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

/**
 * Hybrid navigation support: registers the service worker and pre-downloads map
 * tiles within a corridor (default 2 km) around the route so guidance keeps
 * working when the connection drops.
 */
export function useOffline() {
  const state = useState('offline', () => ({ total: 0, done: 0, running: false, message: '' }))
  const config = useRuntimeConfig()

  async function register() {
    if (!('serviceWorker' in navigator)) return
    try {
      await navigator.serviceWorker.register(import.meta.dev ? '/sw.js?dev=1' : '/sw.js')
    } catch (e) {
      console.warn('SW register failed', e)
    }
  }

  async function tileTemplate(): Promise<{ url: string; maxzoom: number }> {
    const style = await $fetch<any>(config.public.mapStyle)
    const src = Object.values<any>(style.sources).find((s) => s.type === 'vector')
    if (src.tiles?.[0]) return { url: src.tiles[0], maxzoom: src.maxzoom ?? 14 }
    const tj = await $fetch<any>(src.url)
    return { url: tj.tiles[0], maxzoom: tj.maxzoom ?? 14 }
  }

  async function prefetchRoute(line: LngLat[], radius = 2000, minZoom = 8) {
    if (state.value.running) return
    state.value = { total: 0, done: 0, running: true, message: 'Đang chuẩn bị…' }
    try {
      const { url, maxzoom } = await tileTemplate()
      const cum = cumulative(line)
      const total = cum[cum.length - 1]!
      const keys = new Set<string>()
      for (let d = 0; d <= total; d += 500) {
        const { point: [lon, lat] } = pointAlong(line, cum, d)
        const dLat = radius / 111_320
        const dLon = radius / (111_320 * Math.cos((lat * Math.PI) / 180))
        for (let z = minZoom; z <= maxzoom; z++) {
          const x0 = lon2tile(lon - dLon, z), x1 = lon2tile(lon + dLon, z)
          const y0 = lat2tile(lat + dLat, z), y1 = lat2tile(lat - dLat, z)
          for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.add(`${z}/${x}/${y}`)
        }
      }
      const list = [...keys].slice(0, 4000)
      state.value.total = list.length
      state.value.message = keys.size > list.length ? 'Tuyến quá dài – chỉ tải 4000 ô bản đồ đầu tiên' : ''
      let i = 0
      const worker = async () => {
        while (i < list.length) {
          const [z, x, y] = list[i++]!.split('/')
          const u = url.replace('{z}', z!).replace('{x}', x!).replace('{y}', y!)
          try { await fetch(u, { mode: 'cors' }) } catch {}
          state.value.done++
        }
      }
      await Promise.all(Array.from({ length: 6 }, worker))
      localStorage.setItem('dlimap:offlineTilesAt', String(Date.now()))
      state.value.message ||= `Đã lưu ${list.length} ô bản đồ trong bán kính ${radius / 1000} km quanh tuyến`
    } catch (e) {
      state.value.message = 'Không tải được dữ liệu bản đồ – kiểm tra kết nối mạng'
    } finally {
      state.value.running = false
    }
  }

  async function clearCache() {
    await caches.delete('dlimap-tiles')
    localStorage.removeItem('dlimap:offlineTilesAt')
    state.value.message = 'Đã xoá bản đồ ngoại tuyến'
  }

  return { state, register, prefetchRoute, clearCache }
}
