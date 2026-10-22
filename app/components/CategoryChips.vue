<script setup lang="ts">
import type { NearbyCategory } from '#shared/types'

const { state, search, clear } = useNearby()
const { map } = useMap()

function pick(id: NearbyCategory) {
  if (state.value.category === id) return clear()
  const c = map.value?.getCenter()
  if (c) search(id, [c.lng, c.lat])
}

// the row scrolls sideways; arrows + edge fade show there is more (the scrollbar is hidden)
const row = ref<HTMLElement>()
const canLeft = ref(false)
const canRight = ref(false)
function update() {
  const el = row.value
  if (!el) return
  canLeft.value = el.scrollLeft > 2
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
}
function scrollBy(dir: 1 | -1) {
  row.value?.scrollBy({ left: dir * row.value.clientWidth * 0.7, behavior: 'smooth' })
}
/** mouse wheels only scroll vertically – turn that into sideways scrolling */
function onWheel(e: WheelEvent) {
  if (!row.value || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
  row.value.scrollLeft += e.deltaY
  e.preventDefault()
}
let ro: ResizeObserver | undefined
onMounted(() => {
  update()
  ro = new ResizeObserver(update)
  if (row.value) ro.observe(row.value)
})
onBeforeUnmount(() => ro?.disconnect())

const fade = computed(() => {
  const l = canLeft.value ? 'transparent 0, #000 40px' : '#000 0'
  const r = canRight.value ? '#000 calc(100% - 40px), transparent 100%' : '#000 100%'
  const m = `linear-gradient(to right, ${l}, ${r})`
  return { maskImage: m, WebkitMaskImage: m }
})
</script>

<template>
  <div class="pointer-events-auto relative">
    <div
      ref="row"
      class="flex gap-1.5 overflow-x-auto px-0.5 pt-0.5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      :style="fade"
      @scroll.passive="update"
      @wheel="onWheel"
    >
      <Button
        v-for="c in NEARBY_CATEGORIES" :key="c.id"
        rounded size="small"
        :severity="state.category === c.id ? undefined : 'secondary'"
        :label="c.label" :icon="ICON[c.icon]"
        class="flex-none border-0 text-[13px] font-semibold whitespace-nowrap shadow-[0_2px_8px_rgba(15,23,42,0.18)]"
        :class="{ 'bg-bg text-fg hover:bg-bg-2': state.category !== c.id }"
        @click="pick(c.id)"
      />
    </div>
    <Button
      v-if="canLeft"
      :icon="ICON.back" rounded severity="secondary"
      class="absolute top-0.5 left-0 size-[33px] border-0 bg-bg text-fg shadow-card hover:bg-bg-2"
      aria-label="Xem các danh mục trước" @click="scrollBy(-1)"
    />
    <Button
      v-if="canRight"
      :icon="ICON.forward" rounded severity="secondary"
      class="absolute top-0.5 right-0 size-[33px] border-0 bg-bg text-fg shadow-card hover:bg-bg-2"
      aria-label="Xem thêm danh mục" @click="scrollBy(1)"
    />
  </div>
</template>
