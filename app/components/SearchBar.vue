<script setup lang="ts">
import type { Place } from '~/composables/useNavigation'
import type { LngLat } from '#shared/types'

const emit = defineEmits<{ menu: [] }>()
const { nav, plan, clear } = useNavigation()
const { pickMode, map } = useMap()
const { pos } = usePosition()
const online = useOnline()

/** which field the suggestion list is open for (shared so the page can hide what it would cover) */
const active = useState<'origin' | 'destination' | null>('searchActive', () => null)
const root = ref<HTMLElement>()
const query = ref('')
const results = ref<Place[]>([])
const loading = ref(false)
const recent = usePersisted<{ items: Place[] }>('recentPlaces', () => ({ items: [] }))
const { saved } = useSavedPlaces()

// Search as you type, gently: the free geocoders behind /api/geocode block clients that send too much.
// Wait for a pause in typing and ≥ 3 characters, drop answers to queries already typed over, and
// remember answers for this session (deleting a letter and typing it again costs nothing).
const MIN_CHARS = 3
const answers = new Map<string, Place[]>()
let timer: ReturnType<typeof setTimeout> | undefined
let inflight: AbortController | undefined
watch(query, (q) => {
  clearTimeout(timer)
  inflight?.abort()
  const text = q.trim()
  if (text.length < MIN_CHARS) { results.value = []; loading.value = false; return }
  const near = nearParam()
  // ~1 km grid: moving a little doesn't change the answer
  const key = `${text.toLowerCase()}|${near?.split(',').map((v) => (+v).toFixed(2)).join(',') ?? ''}`
  const known = answers.get(key)
  if (known) { results.value = known; loading.value = false; return }
  loading.value = true
  timer = setTimeout(async () => {
    const ctrl = (inflight = new AbortController())
    try {
      const list = await $fetch<Place[]>('/api/geocode', { query: { q: text, near }, signal: ctrl.signal })
      answers.set(key, list)
      if (answers.size > 100) answers.delete(answers.keys().next().value!)
      results.value = list
    } catch {
      if (ctrl.signal.aborted) return
      results.value = []
    }
    loading.value = false
  }, 500)
})

/** Bias results to where the user is (GPS), else to what they're looking at (map centre). */
function biasPoint(): LngLat | null {
  if (pos.value.lngLat) return pos.value.lngLat
  const c = map.value?.getCenter()
  return c ? [c.lng, c.lat] : null
}
const nearParam = () => {
  const p = biasPoint()
  return p ? `${p[1].toFixed(4)},${p[0].toFixed(4)}` : undefined
}

/** "1,2 km" from the user / map centre, shown at the end of a row like Google Maps. */
function distanceTo(p: Place): string {
  const from = biasPoint()
  return from ? formatDistance(haversine(from, [p.lon, p.lat])) : ''
}

/** Second line: type of place (for businesses) and short address. */
function subtitle(p: Place): string {
  const type = p.kind === 'poi' && p.category ? poiCategory(p.category, p.category) : p.kind === 'street' ? 'Đường' : undefined
  return [type, p.address].filter(Boolean).join(' · ')
}

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

const list = computed(() => (query.value.trim().length >= MIN_CHARS ? results.value : recent.value.items))

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
      <!-- one row per result, like Google Maps: icon · name (typed part in bold) · type & address · distance -->
      <button
        v-for="p in list" :key="`${p.lat},${p.lon},${p.name}`"
        class="flex w-full items-center gap-3 rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left hover:bg-bg-2"
        @mousedown.prevent="choose(p)"
      >
        <span class="grid size-8 flex-none place-items-center rounded-full bg-bg-2 text-muted">
          <AppIcon :name="query ? searchIcon(p.kind, p.category) : 'hours'" :size="18" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate">
            <template v-for="(part, i) in highlight(p.name, query)" :key="i"><b v-if="part.b">{{ part.t }}</b><span v-else>{{ part.t }}</span></template>
          </span>
          <span class="block truncate text-[13px] text-muted">
            <span v-if="p.approx" class="font-semibold text-warn">Vị trí gần đúng · </span>{{ subtitle(p) }}
          </span>
        </span>
        <span v-if="distanceTo(p)" class="flex-none text-xs text-muted">{{ distanceTo(p) }}</span>
      </button>
      <div v-if="query.trim().length >= MIN_CHARS && !loading && online && !results.length" class="px-2.5 py-2 text-[13px] text-muted">
        Không tìm thấy “{{ query.trim() }}”. Thử gõ tên đường, phường hoặc tên khác của địa điểm.
      </div>
    </div>
  </div>
</template>
