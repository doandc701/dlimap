<script setup lang="ts">
/**
 * The app's icon: a Material Symbols glyph from the ICON registry (app/utils/icons.ts).
 * It is a 1em square that follows the surrounding font size and colour; `size` overrides
 * the size (px number or any CSS length). Decorative by default – give `label` when the
 * icon carries meaning on its own.
 */
const props = defineProps<{ name: IconName; size?: number | string; label?: string }>()
const style = computed(() => (props.size == null ? undefined : { fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size }))
</script>

<template>
  <span
    :class="ICON[name]" class="inline-block shrink-0 align-[-0.15em]" :style="style"
    :role="label ? 'img' : undefined" :aria-label="label" :aria-hidden="label ? undefined : 'true'"
  />
</template>
