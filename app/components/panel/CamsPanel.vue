<script setup lang="ts">
import type { Poi } from '#shared/types'

defineEmits<{ close: [] }>()
const { pos } = usePosition()
const { map } = useMap()
const cams = ref<(Poi & { d: number })[]>([])
const loading = ref(false)
const error = ref('')

const PORTALS = [
  { city: 'TP. Hồ Chí Minh', url: 'https://giaothong.hochiminhcity.gov.vn/', note: 'Cổng thông tin giao thông của Sở GTVT TP.HCM – xem camera trực tiếp tại các nút giao' },
]

async function load() {
  const c = pos.value.lngLat ?? (map.value ? ([map.value.getCenter().lng, map.value.getCenter().lat] as [number, number]) : null)
  if (!c) return
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ pois: Poi[] }>('/api/pois', { method: 'POST', body: { center: c, radius: 5000 } })
    cams.value = res.pois
      .filter((p) => ['surveillance', 'speed_camera', 'red_light_camera'].includes(p.kind))
      .map((p) => ({ ...p, d: haversine(c, [p.lon, p.lat]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 50)
  } catch {
    error.value = 'Không tải được danh sách camera'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const LABEL: Record<string, string> = { surveillance: 'Camera giám sát', speed_camera: 'Camera tốc độ', red_light_camera: 'Camera đèn đỏ' }
</script>

<template>
  <AppPanel title="Camera giao thông" @close="$emit('close')">
    <h3>Xem camera trực tuyến</h3>
    <ul class="list">
      <li v-for="p in PORTALS" :key="p.city">
        <a :href="p.url" target="_blank" rel="noopener" class="text-accent no-underline"><b>{{ p.city }}</b> ↗</a>
        <div class="text-[13px] text-muted">{{ p.note }}</div>
      </li>
    </ul>

    <h3>Camera trong bán kính 5 km</h3>
    <p v-if="loading" class="my-3 text-[13px] text-muted">Đang tải…</p>
    <Message v-else-if="error" severity="error" size="small" variant="simple" class="my-3">{{ error }}</Message>
    <ul v-else class="list">
      <li v-for="c in cams" :key="c.id" class="flex items-center gap-2">
        <AppIcon :name="POI_ICON[c.kind] ?? 'surveillance'" :size="18" class="text-muted" /><span class="min-w-0 flex-1">{{ LABEL[c.kind] }}<span v-if="c.name" class="text-muted"> · {{ c.name }}</span></span>
        <Button :label="formatDistance(c.d)" :icon="ICON.goTo" icon-pos="right" severity="secondary" size="small" @click="map?.flyTo({ center: [c.lon, c.lat], zoom: 17 }); $emit('close')" />
      </li>
      <li v-if="!cams.length" class="text-[13px] text-muted">Chưa có dữ liệu camera ở khu vực này trên OpenStreetMap.</li>
    </ul>
  </AppPanel>
</template>
