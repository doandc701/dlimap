<script setup lang="ts">
/**
 * Cảm biến áp suất lốp (TPMS) gắn ngoài, đọc qua Web Bluetooth.
 *
 * Hỗ trợ 2 loại cảm biến BLE phổ biến, chỉ phát quảng bá (advertisement), không cần kết nối:
 *  - "TPMS" (company id 0x0100, service 0xFBB0) – theo Theengs decoder (TPMS_json.h):
 *      [0] vị trí bánh (nibble thấp + 1) · [0..5] MAC · [6..9] áp suất Pa (uint32 LE)
 *      [10..13] nhiệt độ ×100 °C (int32 LE) · [14] pin % · [15] bit0 = báo mất áp
 *    (offset tính sau 2 byte company id, vì Web Bluetooth đã tách company id ra)
 *  - "BR" (service 0x27A5) – theo andi38/TPMS: 7 byte không có company id, nên Web Bluetooth
 *    hiểu 2 byte đầu (trạng thái, pin 0.1 V) là "company id"; phần còn lại:
 *      [0] nhiệt độ °C · [1..2] áp suất tuyệt đối 0.1 psi (BE)
 *
 * Đọc quảng bá cần `watchAdvertisements()`, hiện vẫn sau cờ
 * chrome://flags/#enable-experimental-web-platform-features (Chrome Android/Windows/macOS).
 */
defineEmits<{ close: [] }>()
const { say } = useVoice()

const POSITIONS = ['Trước trái', 'Trước phải', 'Sau trái', 'Sau phải']
const LOW = 1.9, HIGH = 3.2, HOT = 75

interface Sensor {
  id: string
  name: string
  position: number
  bar: number | null
  temp: number | null
  battery: string | null
  alarm: boolean
  seenAt: number | null
}

const sensors = ref<Sensor[]>([])
const error = ref('')
const bt = (navigator as any).bluetooth
const supported = !!bt
const canWatch = typeof window !== 'undefined' && 'BluetoothDevice' in window && 'watchAdvertisements' in (window as any).BluetoothDevice.prototype

function status(s: Sensor) {
  if (s.bar == null) return 'wait'
  if (s.alarm || s.bar < LOW) return 'low'
  if (s.bar > HIGH || (s.temp ?? 0) > HOT) return 'high'
  return 'ok'
}

function parse(s: Sensor, e: any) {
  const md: Map<number, DataView> = e.manufacturerData
  const std = md.get(0x0100)
  if (std && std.byteLength >= 16) {
    s.position = Math.min(3, std.getUint8(0) & 0x0f)
    s.bar = Math.round((std.getUint32(6, true) / 100_000) * 100) / 100
    s.temp = Math.round(std.getInt32(10, true) / 10) / 10
    s.battery = `${std.getUint8(14)}%`
    s.alarm = (std.getUint8(15) & 1) === 1
    s.seenAt = Date.now()
    return
  }
  // "BR" variant: the first two payload bytes were consumed as the company id
  for (const [key, dv] of md) {
    if (dv.byteLength < 3) continue
    const psiAbs = ((dv.getUint8(1) << 8) | dv.getUint8(2)) / 10
    s.bar = Math.max(0, Math.round(((psiAbs - 14.7) / 14.504) * 100) / 100)
    s.temp = dv.getUint8(0)
    s.battery = `${(((key >> 8) & 0xff) / 10).toFixed(1)} V`
    s.alarm = false
    s.seenAt = Date.now()
    return
  }
}

async function addSensor() {
  error.value = ''
  if (!supported) return (error.value = 'Trình duyệt không hỗ trợ Web Bluetooth. Hãy dùng Chrome hoặc Edge trên Android / Windows / macOS.')
  if (!canWatch) return (error.value = 'Trình duyệt chưa bật đọc quảng bá BLE. Mở chrome://flags/#enable-experimental-web-platform-features, chọn Enabled rồi khởi động lại Chrome.')
  try {
    const device = await bt.requestDevice({
      filters: [{ namePrefix: 'TPMS' }, { services: [0xfbb0] }, { services: [0x27a5] }],
      optionalManufacturerData: [0x0100],
    })
    if (sensors.value.some((s) => s.id === device.id)) return
    const s = reactive<Sensor>({
      id: device.id, name: device.name || 'Cảm biến', position: sensors.value.length % 4,
      bar: null, temp: null, battery: null, alarm: false, seenAt: null,
    })
    sensors.value.push(s)
    device.addEventListener('advertisementreceived', (e: any) => {
      parse(s, e)
      const st = status(s)
      if (st === 'low' || st === 'high') say(`Cảnh báo áp suất lốp ${POSITIONS[s.position]!.toLowerCase()} ${st === 'low' ? 'thấp' : 'cao'}`, `tire-${s.id}`, 300_000)
    })
    await device.watchAdvertisements()
  } catch (e: any) {
    if (e?.name !== 'NotFoundError') error.value = String(e?.message ?? e)
  }
}

const positionOptions = POSITIONS.map((label, value) => ({ value, label }))
const byPosition = computed(() => POSITIONS.map((label, i) => ({ label, sensor: sensors.value.find((s) => s.position === i) })))
</script>

<template>
  <AppPanel title="Cảm biến áp suất lốp" @close="$emit('close')">
    <div class="relative grid grid-cols-2 gap-x-[90px] gap-y-[70px] pt-2.5 pb-4">
      <div
        v-for="(p, i) in byPosition" :key="i"
        class="min-h-[84px] rounded-[14px] border-2 p-2.5"
        :class="{
          'border-line bg-bg-2': !p.sensor || status(p.sensor) === 'wait',
          'border-ok bg-[color-mix(in_srgb,var(--ok)_14%,var(--bg))]': p.sensor && status(p.sensor) === 'ok',
          'border-danger bg-[color-mix(in_srgb,var(--danger)_14%,var(--bg))]': p.sensor && ['low', 'high'].includes(status(p.sensor)),
        }"
      >
        <div class="text-[13px]">{{ p.label }}</div>
        <template v-if="p.sensor?.bar != null">
          <div class="text-2xl font-extrabold">{{ p.sensor.bar.toFixed(2) }} <small>bar</small></div>
          <div class="text-[13px]">{{ p.sensor.temp }}°C · {{ Math.round(p.sensor.bar * 14.504) }} psi</div>
        </template>
        <div v-else class="text-[13px] text-muted">{{ p.sensor ? 'Đang chờ tín hiệu…' : 'Chưa có cảm biến' }}</div>
      </div>
      <div class="pointer-events-none absolute inset-0 grid place-items-center text-muted"><AppIcon name="car" :size="72" /></div>
    </div>

    <Button label="Thêm cảm biến Bluetooth" :icon="ICON.bluetooth" fluid @click="addSensor" />
    <Message v-if="error" severity="error" size="small" variant="simple" class="my-3">{{ error }}</Message>

    <ul v-if="sensors.length" class="list text-[13px]">
      <li v-for="s in sensors" :key="s.id" class="flex items-center gap-2">
        <span class="min-w-0 flex-1"><b>{{ s.name }}</b><br><span class="text-muted">Pin {{ s.battery ?? '—' }} · {{ s.seenAt ? `cập nhật ${new Date(s.seenAt).toLocaleTimeString('vi-VN')}` : 'chưa nhận dữ liệu' }}</span></span>
        <Select v-model="s.position" :options="positionOptions" option-label="label" option-value="value" size="small" :aria-label="`Vị trí bánh của ${s.name}`" class="[&.p-focus]:border-(--p-form-field-border-color)!" />
      </li>
    </ul>

    <p class="my-3 text-[13px] text-muted">
      Hỗ trợ cảm biến TPMS gắn ngoài loại Bluetooth (BLE) tên "TPMS" hoặc "BR". Cảnh báo khi dưới {{ LOW }} bar,
      trên {{ HIGH }} bar hoặc trên {{ HOT }}°C. Cảm biến chỉ phát khi bánh xe quay hoặc áp suất thay đổi.
    </p>
  </AppPanel>
</template>
