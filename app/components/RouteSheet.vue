<script setup lang="ts">
import type { TravelMode } from '#shared/types'

const emit = defineEmits<{ open: [panel: string] }>()
const { nav, route, tollTotal, tollUnknown, selectRoute, setMode, start, stop } = useNavigation()
const retryPois = () => selectRoute(nav.value.selected)
const { routeTraffic, routeDelays } = useTrafficSummary()
const { fitLine, follow } = useMap()
const { wallet } = useWallet()
const { state: offline, prefetchRoute } = useOffline()
const settings = useSettings()
const showSteps = ref(false)

const eta = computed(() => {
  const secs = nav.value.progress?.remainingTime ?? (route.value ? route.value.duration + (routeTraffic.value?.delay ?? 0) : 0)
  return new Date(Date.now() + secs * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
})

const mode = computed(() => route.value?.mode ?? settings.value.travelMode)

/** "18 phút", "2 giờ 47" – short enough for the travel-mode tabs */
function shortDuration(secs: number) {
  const min = Math.max(1, Math.round(secs / 60))
  return min < 60 ? `${min} phút` : `${Math.floor(min / 60)} giờ${min % 60 ? ` ${min % 60}` : ''}`
}

/** Duration shown under each travel-mode tab: … while loading, – when there is no route. */
function modeTime(m: TravelMode) {
  if (m === mode.value && route.value) return shortDuration(route.value.duration + (routeTraffic.value?.delay ?? 0))
  const rs = nav.value.modeRoutes[m]
  if (!rs) return nav.value.offlineRoute ? '' : '…'
  return rs.length ? shortDuration(rs[0]!.duration) : '–'
}

const cameras = computed(() => nav.value.pois.filter((p) => p.kind === 'speed_camera' || p.kind === 'red_light_camera').length)

watch(route, (r) => { if (r && !nav.value.active) fitLine(r.geometry) })

/** inline text-link buttons inside the facts line */
const LINK = 'p-0! text-[13px]! font-semibold! text-accent!'

function begin(sim: boolean) {
  start(sim)
  follow.value = true
}
</script>

<template>
  <!-- navigating -->
  <div v-if="nav.active && route" class="card pointer-events-auto max-h-[45vh] overflow-auto px-3.5 py-3">
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <div class="text-[22px] font-extrabold text-ok">{{ formatDuration(nav.progress?.remainingTime ?? route.duration) }}</div>
        <div class="text-[13px] text-muted">{{ formatDistance(nav.progress?.remaining ?? route.distance) }} · Đến lúc {{ eta }}<template v-if="routeTraffic && routeTraffic.delay >= 60"> · <AppIcon name="traffic" /> +{{ Math.round(routeTraffic.delay / 60) }} phút</template></div>
      </div>
      <SelectButton v-if="nav.simulating" v-model="nav.simFactor" :options="[1, 2, 4, 8]" :allow-empty="false" size="small" aria-label="Tốc độ mô phỏng">
        <template #option="{ option }">{{ option }}×</template>
      </SelectButton>
      <Button label="Thoát" severity="danger" @click="stop" />
    </div>
  </div>

  <!-- route preview -->
  <div v-else-if="route || nav.loading || nav.error" class="card pointer-events-auto max-h-[45vh] overflow-auto px-3.5 py-3">
    <SelectButton
      :model-value="mode" :options="TRAVEL_MODES" option-value="mode" data-key="mode" :allow-empty="false"
      class="mb-2.5 flex w-full" aria-label="Phương tiện"
      :pt="{ pcToggleButton: { root: { class: 'min-w-0 flex-1 px-1!' } } }"
      @update:model-value="(m: TravelMode) => setMode(m)"
    >
      <template #option="{ option }">
        <span class="flex min-w-0 items-center justify-center gap-1 font-semibold whitespace-nowrap" :title="option.label" :aria-label="option.label">
          <AppIcon :name="option.icon" :size="18" />
          <span class="truncate text-[13px]">{{ modeTime(option.mode) }}</span>
        </span>
      </template>
    </SelectButton>
    <div v-if="!route && nav.loading" class="text-muted">Đang tìm đường…</div>
    <div v-else-if="!route" class="font-semibold text-danger">{{ nav.error }}</div>
    <template v-else>
      <Tag v-if="nav.offlineRoute" severity="warn" value="Tuyến đã lưu (ngoại tuyến)" class="mb-2 text-[11px]" />
      <div class="flex gap-2 overflow-x-auto">
        <button
          v-for="(r, i) in nav.routes" :key="i" class="flex min-w-[110px] flex-1 flex-col items-start rounded-xl border-2 p-2"
          :class="i === nav.selected ? 'border-primary bg-[color-mix(in_srgb,var(--primary)_8%,var(--bg))]' : 'border-line bg-bg'"
          @click="selectRoute(i)"
        >
          <b class="text-[17px]">{{ formatDuration(r.duration + (routeDelays[i] ?? 0)) }}</b>
          <span class="text-[13px] text-muted">{{ formatDistance(r.distance) }}</span>
        </button>
      </div>
      <div v-if="isMotorized(mode)" class="my-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
        <span v-if="routeTraffic" :class="{ 'font-semibold text-danger': routeTraffic.delay > 300 }" title="Theo dữ liệu giao thông thời gian thực TomTom trên phần tuyến đang hiển thị">
          <AppIcon name="traffic" /> {{ routeTraffic.delay >= 60 ? `Chậm thêm ${Math.round(routeTraffic.delay / 60)} phút do kẹt xe` : 'Giao thông thông thoáng' }}<template v-if="routeTraffic.jammedKm >= 0.3"> · {{ routeTraffic.jammedKm.toFixed(1) }} km ùn tắc</template>
        </span>
        <span v-if="nav.poisError" class="font-semibold text-danger" title="Máy chủ dữ liệu OpenStreetMap (Overpass) không phản hồi"><AppIcon name="speedCamera" /> Chưa tải được camera/trạm BOT <Button label="Thử lại" link :class="LINK" @click="retryPois" /></span>
        <span v-else><AppIcon name="speedCamera" /> {{ nav.poisLoading ? '…' : cameras }} camera</span>
        <span v-if="mode === 'motorbike'" class="text-muted"><AppIcon name="motorbike" /> Tránh đường cao tốc, không mất phí BOT</span>
        <Button v-else link :class="LINK" @click="emit('open', 'toll')"><AppIcon name="toll" /> Phí: {{ nav.poisLoading ? '…' : formatVnd(tollTotal) }}{{ !nav.poisLoading && tollUnknown ? ` + ${tollUnknown} chưa có giá` : '' }}</Button>
        <span v-if="mode === 'car' && wallet.balance != null && tollTotal > wallet.balance" class="font-semibold text-danger">Số dư {{ wallet.provider }} không đủ</span>
      </div>
      <div class="mb-1.5 flex items-center gap-2" :class="{ 'mt-2.5': !isMotorized(mode) }">
        <Button label="Bắt đầu" :icon="ICON.start" class="min-w-0 flex-1" @click="begin(false)" />
        <Button label="Mô phỏng" :icon="ICON.simulate" severity="secondary" title="Chạy thử dọc tuyến" @click="begin(true)" />
        <Button
          :label="offline.running ? `${Math.round((offline.done / Math.max(1, offline.total)) * 100)}%` : 'Offline'"
          :icon="offline.running ? `${ICON.spinner} animate-spin` : ICON.download" severity="secondary"
          :disabled="offline.running" title="Tải bản đồ 2 km quanh tuyến để dùng khi mất mạng" @click="prefetchRoute(route.geometry)"
        />
      </div>
      <div v-if="offline.message && !offline.running" class="text-[13px] text-muted">{{ offline.message }}</div>
      <Button link :class="LINK" @click="showSteps = !showSteps">{{ showSteps ? 'Ẩn' : 'Xem' }} chỉ dẫn ({{ route.steps.length }} bước)</Button>
      <ol v-if="showSteps" class="mt-2 list-decimal pl-[18px] text-[13px]">
        <li v-for="(s, i) in route.steps" :key="i" class="my-1">{{ s.instruction }} <span class="text-muted">· {{ formatDistance(s.distance) }}</span></li>
      </ol>
    </template>
  </div>
</template>
