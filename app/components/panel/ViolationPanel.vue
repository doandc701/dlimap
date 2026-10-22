<script setup lang="ts">
/**
 * Tra cứu phạt nguội: chuyển sang cổng chính thức của Cục CSGT.
 * Cổng yêu cầu người tra cứu tự đăng nhập VNeTraffic/VNeID (định danh mức 2) và
 * dùng reCAPTCHA v3, nên không có cách hợp lệ để máy chủ DLiMap tra cứu hộ.
 */
defineEmits<{ close: [] }>()
const OFFICIAL = 'https://csgt.bocongan.gov.vn/tra-cuu-phat-nguoi'

const plate = ref('')
const type = ref<'car' | 'motorbike' | 'electricbike'>('car')
const copied = ref(false)
const TYPES = [{ value: 'car', label: 'Ô tô' }, { value: 'motorbike', label: 'Xe máy' }, { value: 'electricbike', label: 'Xe điện' }]

const normalized = computed(() => plate.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))
const valid = computed(() => /^\d{2}[A-Z]{1,2}\d{4,6}$/.test(normalized.value))

async function lookup() {
  try {
    await navigator.clipboard.writeText(normalized.value)
    copied.value = true
  } catch {}
  window.open(OFFICIAL, '_blank', 'noopener')
}
</script>

<template>
  <AppPanel title="Tra cứu phạt nguội" @close="$emit('close')">
    <form @submit.prevent="lookup">
      <SelectButton v-model="type" :options="TYPES" option-label="label" option-value="value" :allow-empty="false" fluid class="mb-2" aria-label="Loại xe" />
      <div class="flex items-center gap-2">
        <InputText v-model="plate" class="min-w-0 flex-1 focus:border-(--p-form-field-border-color)!" placeholder="Biển số, vd: 30A-123.45" autocapitalize="characters" aria-label="Biển số" />
        <Button type="submit" label="Tra cứu" :icon="ICON.external" icon-pos="right" :disabled="!valid" />
      </div>
      <Message v-if="plate && !valid" severity="error" size="small" variant="simple" class="my-3">Biển số chưa đúng định dạng (vd: 30A12345, 59X112345).</Message>
      <Message v-if="copied" severity="success" size="small" variant="simple" class="my-3">Đã sao chép biển số <b>{{ normalized }}</b> – dán vào ô "Biển số" trên trang của Cục CSGT.</Message>
    </form>

    <h3>Cách tra cứu chính thức</h3>
    <ol class="list-decimal pl-[18px] text-[13px] [&>li]:my-1">
      <li>Mở trang <a :href="OFFICIAL" target="_blank" rel="noopener" class="text-accent underline">csgt.bocongan.gov.vn/tra-cuu-phat-nguoi</a> (nút Tra cứu ở trên).</li>
      <li>Chọn loại xe ({{ type === 'car' ? 'Ô tô' : type === 'motorbike' ? 'Xe máy' : 'Xe điện' }}), dán biển số.</li>
      <li>Đăng nhập VNeTraffic bằng tài khoản VNeID đã định danh mức 2 khi được yêu cầu.</li>
    </ol>
    <p class="my-3 text-[13px] text-muted">
      Muốn tự nhận thông báo khi có vi phạm: cài ứng dụng <b>VNeTraffic</b> (Bộ Công an), liên kết VNeID và khai báo phương tiện của bạn.
    </p>
    <p class="my-3 text-[13px] text-muted">
      DLiMap không lưu và không gửi biển số của bạn đi đâu. Hãy cảnh giác với tin nhắn/website "thông báo phạt nguội" giả mạo.
    </p>
  </AppPanel>
</template>
