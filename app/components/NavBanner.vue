<script setup lang="ts">
const { nav, route } = useNavigation()
const online = useOnline()

const next = computed(() => {
  const p = nav.value.progress
  const r = route.value
  if (!p || !r) return null
  return r.steps[p.stepIdx + 1] ?? null
})
const after = computed(() => {
  const p = nav.value.progress
  return p && route.value ? route.value.steps[p.stepIdx + 2] ?? null : null
})

const TURN: Record<string, IconName> = {
  'straight': 'straight', 'slight right': 'slightRight', 'right': 'turnRight', 'sharp right': 'sharpRight', 'uturn': 'uturn',
  'slight left': 'slightLeft', 'left': 'turnLeft', 'sharp left': 'sharpLeft',
}
/** Maneuver glyph of the next step, as on Google Maps' turn banner. */
const maneuverIcon = computed<IconName>(() => {
  const m = next.value?.maneuver
  if (m === 'arrive') return 'arrive'
  if (m === 'roundabout' || m === 'rotary' || m === 'roundabout turn' || m === 'exit roundabout' || m === 'exit rotary') return 'roundabout'
  return TURN[next.value?.modifier ?? 'straight'] ?? 'straight'
})
</script>

<template>
  <div v-if="nav.active" class="card pointer-events-auto bg-primary px-3.5 py-3 text-primary-contrast">
    <div class="flex items-center gap-2">
      <div class="grid size-[52px] flex-none place-items-center">
        <AppIcon :name="maneuverIcon" :size="46" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[26px] leading-[1.1] font-extrabold in-[.car]:text-4xl">{{ nav.progress ? formatDistance(nav.progress.distToStep) : '…' }}</div>
        <div class="text-[15px] font-semibold in-[.car]:text-[19px]">{{ next?.instruction ?? 'Đang xác định vị trí trên tuyến…' }}</div>
      </div>
    </div>
    <div v-if="after" class="mt-1.5 border-t border-white/25 pt-1.5 text-[13px] opacity-85">Sau đó: {{ after.instruction }}</div>
    <div v-if="nav.progress?.offRoute" class="mt-1.5 rounded-lg bg-[#f59e0b] px-2 py-1 text-[13px] font-bold text-[#111]">
      {{ online ? 'Bạn đã đi lệch tuyến – đang tìm lại đường…' : 'Lệch tuyến & mất mạng – tiếp tục theo tuyến đã lưu' }}
    </div>
    <div v-else-if="!online" class="mt-1.5 flex items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1 text-[13px]"><AppIcon name="offline" /> Đang dẫn đường ngoại tuyến (hybrid)</div>
  </div>
</template>
