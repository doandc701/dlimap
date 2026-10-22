<script setup lang="ts">
import type { Place } from '~/composables/useNavigation'

const emit = defineEmits<{ menu: [] }>()
const { nav, plan, clear } = useNavigation()
const { pickMode } = useMap()
const online = useOnline()

/** which field the suggestion list is open for (shared so the page can hide what it would cover) */
const active = useState<'origin' | 'destination' | null>('searchActive', () => null)
const root = ref<HTMLElement>()
const query = ref('')
const results = ref<Place[]>([])
const loading = ref(false)
const recent = usePersisted<{ items: Place[] }>('recentPlaces', () => ({ items: [] }))
const { saved } = useSavedPlaces()

let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) { results.value = []; return }
  timer = setTimeout(async () => {
    loading.value = true
    try { results.value = await $fetch<Place[]>('/api/geocode', { query: { q } }) } catch { results.value = [] }
    loading.value = false
  }, 350)
})

function focus(which: 'origin' | 'destination') {
  active.value = which
  query.value = ''
  results.value = []
}

function choose(p: Place | null) {
  if (active.value === 'origin') nav.value.origin = p
  else if (p) {
    nav.value.destination = p
    recent.value.items = [p, ...recent.value.items.filter((r) => r.name !== p.name)].slice(0, 6)
  }
  active.value = null
  query.value = ''
  results.value = []
  if (nav.value.destination) plan()
}

function close() {
  active.value = null
  query.value = ''
  results.value = []
  ;(document.activeElement as HTMLElement | null)?.blur()
}

// tapping anywhere outside the search card (map, buttons…) closes the suggestions
function onOutside(e: PointerEvent) {
  if (!active.value || root.value?.contains(e.target as Node)) return
  close()
  // like Google Maps, that tap on the map only dismisses the list – it doesn't also select a place
  if ((e.target as Element).closest?.('.maplibregl-canvas')) {
    document.addEventListener('click', (c) => c.stopPropagation(), { capture: true, once: true })
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && active.value) close()
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside, true)
  document.removeEventListener('keydown', onKey)
  active.value = null
})

function pickOnMap() {
  pickMode.value = active.value
  active.value = null
}

function swap() {
  const o = nav.value.origin
  nav.value.origin = nav.value.destination
  nav.value.destination = o
  if (!nav.value.destination) clear()
  else plan()
}

const list = computed(() => (query.value.trim().length >= 2 ? results.value : recent.value.items))

/** no focus highlight on the fields (border keeps the resting form-field colour) */
const NO_FOCUS = 'focus:border-surface-200 focus:shadow-none dark:focus:border-surface-700'
</script>

<template>
  <div ref="root" class="card pointer-events-auto p-1.5">
    <div v-if="!nav.destination && active !== 'origin'" class="flex items-center gap-1">
      <Button :icon="ICON.menu" text rounded severity="secondary" aria-label="Menu" @click="emit('menu')" />
      <IconField class="min-w-0 flex-1">
        <InputIcon :class="ICON.search" />
        <InputText
          v-model="query"
          fluid
          :class="NO_FOCUS"
          placeholder="Bạn muốn đi đâu?"
          @focus="active = 'destination'"
        />
      </IconField>
    </div>
    <div v-else class="flex flex-col gap-1.5">
      <div class="flex items-center gap-2">
        <span class="mr-1.5 ml-2 size-3 flex-none rounded-full bg-primary" />
        <InputText
          :model-value="active === 'origin' ? query : (nav.origin?.name ?? 'Vị trí của tôi')"
          size="small"
          class="min-w-0 flex-1"
          :class="NO_FOCUS"
          @focus="focus('origin')"
          @update:model-value="(v) => (query = v ?? '')"
        />
        <Button :icon="ICON.swap" text rounded severity="secondary" title="Đảo chiều" aria-label="Đảo chiều" @click="swap" />
      </div>
      <div class="flex items-center gap-2">
        <span class="mr-1.5 ml-2 size-3 flex-none rounded-full bg-danger" />
        <InputText
          :model-value="active === 'destination' ? query : nav.destination?.name"
          size="small"
          class="min-w-0 flex-1"
          :class="NO_FOCUS"
          placeholder="Điểm đến"
          @focus="focus('destination')"
          @update:model-value="(v) => (query = v ?? '')"
        />
        <Button :icon="ICON.close" text rounded severity="secondary" title="Xoá tuyến" aria-label="Xoá tuyến" @click="clear(); nav.origin = null" />
      </div>
    </div>

    <div v-if="active" class="mt-1.5 max-h-[50vh] overflow-auto border-t border-line">
      <!-- traffic around you, shown before typing – like the "current conditions" row in Google Maps -->
      <TrafficSummary v-if="!query" flat class="border-b border-line" />
      <button v-if="active === 'origin'" class="flex w-full items-center gap-2 rounded-[10px] border-0 bg-transparent p-2.5 text-left hover:bg-bg-2" @mousedown.prevent="choose(null)"><AppIcon name="myLocation" :size="18" class="text-primary" /><b>Vị trí của tôi</b></button>
      <button class="flex w-full items-center gap-2 rounded-[10px] border-0 bg-transparent p-2.5 text-left hover:bg-bg-2" @mousedown.prevent="pickOnMap"><AppIcon name="map" :size="18" class="text-muted" />Chọn trên bản đồ</button>
      <div v-if="loading" class="px-2.5 py-1.5 text-[13px] text-muted">Đang tìm…</div>
      <div v-else-if="!online" class="px-2.5 py-1.5 text-[13px] text-muted">Mất kết nối – không thể tìm địa điểm</div>
      <template v-if="!query && saved.items.length">
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-muted"><AppIcon name="saved" :size="14" /> Đã lưu</div>
        <button v-for="p in saved.items.slice(0, 5)" :key="`s${p.lat},${p.lon}`" class="block w-full rounded-[10px] border-0 bg-transparent p-2.5 text-left hover:bg-bg-2" @mousedown.prevent="choose(p)">
          <div class="truncate"><b>{{ p.name }}</b></div>
          <div class="truncate text-[13px] text-muted">{{ p.address }}</div>
        </button>
      </template>
      <div v-if="!query && list.length" class="px-2.5 py-1.5 text-[13px] text-muted">Gần đây</div>
      <button v-for="p in list" :key="`${p.lat},${p.lon}`" class="block w-full rounded-[10px] border-0 bg-transparent p-2.5 text-left hover:bg-bg-2" @mousedown.prevent="choose(p)">
        <div class="truncate"><b>{{ p.name }}</b></div>
        <div class="truncate text-[13px] text-muted">{{ p.address }}</div>
      </button>
    </div>
  </div>
</template>
