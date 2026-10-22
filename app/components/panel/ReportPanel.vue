<script setup lang="ts">
import type { Report } from '~/composables/useRoad'

const emit = defineEmits<{ close: [] }>()
const { report } = useRoad()
const note = ref('')
const error = ref('')
const done = ref(false)

const TYPES: { type: Report['type']; icon: IconName; label: string }[] = [
  { type: 'camera', icon: REPORT_ICON.camera!, label: 'Camera' },
  { type: 'police', icon: REPORT_ICON.police!, label: 'CSGT' },
  { type: 'accident', icon: REPORT_ICON.accident!, label: 'Tai nạn' },
  { type: 'jam', icon: REPORT_ICON.jam!, label: 'Kẹt xe' },
  { type: 'hazard', icon: REPORT_ICON.hazard!, label: 'Nguy hiểm' },
]

async function send(t: Report['type']) {
  error.value = ''
  try {
    await report(t, note.value)
    done.value = true
    setTimeout(() => emit('close'), 900)
  } catch (e: any) {
    error.value = e?.message ?? 'Không gửi được báo cáo'
  }
}
</script>

<template>
  <AppPanel title="Báo cáo tại vị trí của bạn" @close="$emit('close')">
    <div v-if="done" class="flex items-center gap-2 py-3 font-bold text-ok"><AppIcon name="check" :size="22" /> Cảm ơn bạn! Báo cáo đã được chia sẻ với cộng đồng.</div>
    <template v-else>
      <div class="mb-3 grid grid-cols-5 gap-1.5">
        <Button
          v-for="t in TYPES" :key="t.type" severity="secondary"
          class="min-w-0 flex-col gap-1.5 rounded-[14px] px-0.5 py-3 text-xs font-semibold whitespace-nowrap"
          @click="send(t.type)"
        >
          <AppIcon :name="t.icon" :size="30" />{{ t.label }}
        </Button>
      </div>
      <InputText v-model="note" fluid maxlength="140" placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú" class="focus:border-(--p-form-field-border-color)!" />
      <Message v-if="error" severity="error" size="small" variant="simple" class="my-3">{{ error }}</Message>
    </template>
  </AppPanel>
</template>
