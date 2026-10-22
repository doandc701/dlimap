<script setup lang="ts">
/**
 * Round icon button with a caption underneath – the "Đường đi · Lưu · Gần đó · Chia sẻ"
 * row of Google Maps. The icon is centred with grid, independent of font metrics.
 */
defineProps<{ icon: IconName; label: string; primary?: boolean; active?: boolean; disabled?: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button" :disabled="disabled"
    class="group flex min-w-16 flex-col items-center gap-1 border-0 bg-transparent p-0 text-xs font-semibold text-primary disabled:opacity-50"
    @click="$emit('click')"
  >
    <span
      class="grid size-10 place-items-center rounded-full transition-colors"
      :class="primary || active ? 'bg-primary text-primary-contrast' : 'bg-primary/12 group-hover:bg-primary/20'"
    >
      <AppIcon :name="icon" :size="20" />
    </span>
    {{ label }}
  </button>
</template>
