<script setup lang="ts">
import type { VehicleClass } from '#shared/types'

defineEmits<{ close: [] }>()
const settings = useSettings()
const { say, engine, hasBrowserVoice } = useVoice()
const trafficEnabled = useState('trafficEnabled', () => false)

const speedClassOptions = Object.entries(SPEED_CLASS_LABEL).map(([value, label]) => ({ value, label }))
const vehicleClassOptions = ([1, 2, 3, 4, 5] as VehicleClass[]).map((value) => ({ value, label: VEHICLE_CLASS_LABEL[value] }))
const voiceEngineOptions = computed(() => [
  { value: 'auto', label: `Tự động${hasBrowserVoice() ? ' (giọng tiếng Việt của trình duyệt)' : ' (qua máy chủ – trình duyệt không có giọng tiếng Việt)'}` },
  { value: 'browser', label: 'Giọng của trình duyệt / hệ điều hành' },
  { value: 'server', label: 'Giọng tiếng Việt qua máy chủ' },
])
</script>

<template>
  <AppPanel title="Cài đặt" @close="$emit('close')">
    <div class="field">
      <span id="set-speed-class">Nhóm xe (giới hạn tốc độ)</span>
      <Select v-model="settings.speedClass" :options="speedClassOptions" option-label="label" option-value="value" fluid aria-labelledby="set-speed-class" class="[&.p-focus]:border-(--p-form-field-border-color)!" />
    </div>
    <div class="field">
      <span id="set-vehicle-class">Loại xe tính phí BOT</span>
      <Select v-model="settings.vehicleClass" :options="vehicleClassOptions" option-label="label" option-value="value" fluid aria-labelledby="set-vehicle-class" class="[&.p-focus]:border-(--p-form-field-border-color)!" />
    </div>
    <div class="field">
      <span id="set-tolerance">Cảnh báo khi vượt quá giới hạn: +{{ settings.tolerance }} km/h</span>
      <Slider v-model="settings.tolerance" :min="0" :max="10" aria-labelledby="set-tolerance" class="mx-2 my-3" />
    </div>
    <div class="flex items-center gap-2.5 py-2.5">
      <ToggleSwitch v-model="settings.voice" input-id="set-voice" />
      <label for="set-voice" class="cursor-pointer">Cảnh báo bằng giọng nói</label>
    </div>
    <div class="field">
      <span id="set-voice-engine">Giọng đọc</span>
      <Select v-model="settings.voiceEngine" :options="voiceEngineOptions" option-label="label" option-value="value" fluid aria-labelledby="set-voice-engine" class="[&.p-focus]:border-(--p-form-field-border-color)!" />
    </div>
    <Button
      :label="`Nghe thử (${engine() === 'browser' ? 'trình duyệt' : 'máy chủ'})`" :icon="ICON.volume" severity="secondary" size="small"
      @click="say('Phía trước 500 mét có camera phạt nguội. Tốc độ tối đa 60 ki lô mét trên giờ', 'test', 0)"
    />
    <div v-if="trafficEnabled" class="flex items-center gap-2.5 py-2.5">
      <ToggleSwitch v-model="settings.showTraffic" input-id="set-traffic" />
      <label for="set-traffic" class="cursor-pointer">Hiển thị tình trạng giao thông thời gian thực (TomTom)</label>
    </div>
    <p v-else class="my-3 text-[13px] text-muted">Lớp kẹt xe thời gian thực chưa bật: máy chủ cần khoá TomTom (<code>NUXT_TOMTOM_KEY</code>).</p>
    <div class="flex items-center gap-2.5 py-2.5">
      <ToggleSwitch v-model="settings.showSignals" input-id="set-signals" />
      <label for="set-signals" class="cursor-pointer">Cảnh báo đèn giao thông phía trước</label>
    </div>

    <h3>Về giới hạn tốc độ</h3>
    <p class="my-3 text-[13px] text-muted">
      Giới hạn lấy từ biển báo trên OpenStreetMap; nếu đường chưa có dữ liệu, DLiMap áp dụng Thông tư 38/2024/TT-BGTVT
      theo nhóm xe: trong khu đông dân cư 60 km/h (đường đôi/một chiều ≥ 2 làn) hoặc 50 km/h; ngoài khu dân cư
      90/80 km/h với ô tô con (thấp hơn với xe tải nặng, xe buýt, xe kéo); xe gắn máy 40 km/h.
      Việc nhận biết "khu đông dân cư" là ước đoán từ bản đồ – luôn tuân theo biển báo thực tế trên đường.
    </p>
  </AppPanel>
</template>
