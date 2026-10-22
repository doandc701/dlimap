<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
const online = useOnline()
const { nav, route, restoreOffline, start } = useNavigation()
const { state, prefetchRoute, clearCache } = useOffline()
const { fitLine } = useMap()

const saved = computed(() => {
  void nav.value.routes
  try {
    const raw = localStorage.getItem('dlimap:offlineRoute')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
})
const tilesAt = ref(localStorage.getItem('dlimap:offlineTilesAt'))
watch(() => state.value.running, (r) => { if (!r) tilesAt.value = localStorage.getItem('dlimap:offlineTilesAt') })

function useSaved() {
  if (restoreOffline() && route.value) {
    fitLine(route.value.geometry)
    emit('close')
  }
}
function navigateSaved() {
  if (restoreOffline()) {
    start(false)
    emit('close')
  }
}
</script>

<template>
  <AppPanel title="Dẫn đường Hybrid" @close="$emit('close')">
    <Message :severity="online ? 'success' : 'error'" :icon="online ? ICON.online : ICON.offline" class="mb-2 font-bold">
      {{ online ? 'Đang trực tuyến' : 'Mất kết nối mạng' }}
    </Message>
    <p class="my-3 text-[13px] text-muted">
      Khi mất mạng, DLiMap vẫn tiếp tục dẫn đường theo tuyến đã lưu: chỉ dẫn rẽ, giọng nói, cảnh báo camera/tốc độ
      đã tải và bản đồ trong bán kính 2 km quanh tuyến. Tìm tuyến mới cần có mạng.
    </p>

    <h3>Tuyến đã lưu</h3>
    <div v-if="saved?.route" class="card bg-bg-2 p-3 shadow-none">
      <b>{{ saved.destination?.name ?? 'Điểm đến' }}</b>
      <div class="text-[13px] text-muted">{{ formatDistance(saved.route.distance) }} · lưu lúc {{ new Date(saved.savedAt).toLocaleString('vi-VN') }}</div>
      <div class="mt-2.5 flex items-center gap-2">
        <Button label="Xem tuyến" :icon="ICON.map" severity="secondary" class="min-w-0 flex-1" @click="useSaved" />
        <Button label="Dẫn đường" :icon="ICON.directions" class="min-w-0 flex-1" @click="navigateSaved" />
      </div>
    </div>
    <p v-else class="my-3 text-[13px] text-muted">Chưa có tuyến nào. Tuyến gần nhất bạn tìm sẽ được tự động lưu.</p>

    <h3>Bản đồ ngoại tuyến</h3>
    <p class="my-3 text-[13px]">{{ tilesAt ? `Đã tải lúc ${new Date(+tilesAt).toLocaleString('vi-VN')}` : 'Chưa tải bản đồ ngoại tuyến' }}</p>
    <ProgressBar v-if="state.running" :value="Math.round((state.done / Math.max(1, state.total)) * 100)" :show-value="false" class="my-2 h-2" />
    <p v-if="state.message" class="my-3 text-[13px] text-muted">{{ state.message }}</p>
    <div class="flex items-center gap-2">
      <Button label="Tải bản đồ quanh tuyến hiện tại" :icon="ICON.download" class="min-w-0 flex-1" :disabled="!route || state.running || !online" @click="prefetchRoute(route!.geometry)" />
      <Button label="Xoá" :icon="ICON.delete" severity="secondary" :disabled="state.running" @click="clearCache(); tilesAt = null" />
    </div>
  </AppPanel>
</template>
