<script setup lang="ts">
/** flat: drawn as a row inside another card (the search suggestions) instead of its own card */
defineProps<{ flat?: boolean }>()
const { area } = useTrafficSummary()
const COLORS = ['#16a34a', '#f59e0b', '#ea580c', '#dc2626']
</script>

<template>
  <div v-if="area" class="pointer-events-auto flex items-center gap-2.5 px-3 py-2" :class="flat ? 'px-2.5' : 'card'" :title="`Tốc độ trung bình bằng ${Math.round(area.ratio * 100)}% tốc độ thông thường (TomTom, thời gian thực)`">
    <span class="grid size-[34px] flex-none place-items-center rounded-full text-white" :style="{ background: COLORS[area.level] }"><AppIcon name="traffic" :size="20" /></span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-bold">{{ AREA_TEXT[area.level][0] }}</div>
      <div class="text-[13px] text-muted">
        {{ AREA_TEXT[area.level][1] }}<template v-if="area.jammedShare >= 0.05"> · {{ Math.round(area.jammedShare * 100) }}% đường đang ùn tắc</template>
      </div>
    </div>
  </div>
</template>
