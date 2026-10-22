<script setup lang="ts">
import type { NearbyPlace } from '#shared/types'

const { state, clear } = useNearby()
const selection = useSelection()
const { map, fitLine } = useMap()
const { pos } = usePosition()

const label = computed(() => NEARBY_CATEGORIES.find((c) => c.id === state.value.category))

// frame the results on the map
watch(() => state.value.items, (items) => {
  if (items.length > 1) fitLine(items.slice(0, 20).map((p) => [p.lon, p.lat]), 40)
})

function open(p: NearbyPlace) {
  selection.value = { kind: 'place', name: p.name, category: label.value?.label, lat: p.lat, lon: p.lon }
  map.value?.easeTo({ center: [p.lon, p.lat], zoom: Math.max(16, map.value.getZoom()) })
}

function sub(p: NearbyPlace) {
  const parts: string[] = []
  const from = pos.value.lngLat ?? state.value.center
  if (from) parts.push(formatDistance(haversine(from, [p.lon, p.lat])))
  if (p.kind && state.value.category === 'restaurant') parts.push(p.kind.split(';').join(', '))
  if (p.openingHours) {
    const h = hoursStatus(p.openingHours, p.lat, p.lon)
    if (h) parts.push(h.open ? 'Đang mở cửa' : 'Đã đóng cửa')
  }
  return parts.join(' · ')
}
</script>

<template>
  <div v-if="state.category && !selection" class="card pointer-events-auto max-h-[45vh] overflow-auto px-3.5 py-2.5">
    <div class="flex items-center gap-2">
      <b class="flex min-w-0 flex-1 items-center gap-2"><AppIcon v-if="label" :name="label.icon" :size="20" class="text-primary" />{{ label?.label }} gần đây</b>
      <Button :icon="ICON.close" text rounded severity="secondary" aria-label="Đóng" @click="clear" />
    </div>
    <p v-if="state.loading" class="my-[13px] flex items-center gap-2 text-[13px] text-muted"><AppIcon name="spinner" class="animate-spin" /> Đang tìm…</p>
    <Message v-else-if="state.error" severity="error" size="small" variant="simple" class="my-[13px]">{{ state.error }}</Message>
    <p v-else-if="!state.items.length" class="my-[13px] text-[13px] text-muted">Không tìm thấy trong bán kính 1,5 km.</p>
    <ul v-else class="list m-0 list-none p-0">
      <li v-for="p in state.items" :key="p.id" class="group cursor-pointer" @click="open(p)">
        <div class="truncate"><b class="group-hover:text-accent">{{ p.name }}</b></div>
        <div class="text-[13px] text-muted">{{ sub(p) }}</div>
      </li>
    </ul>
  </div>
</template>
