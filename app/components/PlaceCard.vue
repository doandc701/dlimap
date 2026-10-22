<script setup lang="ts">
import type { NearbyCategory, PlaceDetails } from '#shared/types'

const selection = useSelection()
const { pos } = usePosition()
const { nav, plan } = useNavigation()
const { reports, isMine, removeReport, markGone, hasVoted } = useRoad()
const { map } = useMap()
const { isSaved, toggle } = useSavedPlaces()
const { search } = useNearby()

const address = ref('')
const details = ref<PlaceDetails | null>(null)
const detailsLoading = ref(false)
const showWeek = ref(false)
const showNearby = ref(false)
const photoOk = ref(true)
const shared = ref('')
const busy = ref(false)
const error = ref('')

const REPORT_LABEL: Record<string, string> = {
  camera: 'Camera (cộng đồng báo)',
  police: 'CSGT',
  accident: 'Tai nạn',
  jam: 'Kẹt xe',
  hazard: 'Nguy hiểm trên đường',
}

const report = computed(() => {
  const s = selection.value
  return s?.kind === 'report' ? reports.value.find((r) => r.id === s.id) ?? null : null
})
const toll = computed(() => {
  const s = selection.value
  return s?.kind === 'toll' ? nav.value.tolls.find((t) => t.id === s.id) ?? null : null
})
const isPlace = computed(() => selection.value?.kind === 'place')

const title = computed(() => {
  const s = selection.value
  if (!s) return ''
  if (s.kind === 'place') return s.name
  if (s.kind === 'report') return REPORT_LABEL[report.value?.type ?? ''] ?? 'Báo cáo'
  if (s.kind === 'toll') return toll.value?.name ?? 'Trạm thu phí'
  return s.name ? `${s.title} · ${s.name}` : s.title
})
const icon = computed<IconName>(() => {
  const s = selection.value
  if (s?.kind === 'report') return REPORT_ICON[report.value?.type ?? ''] ?? 'hazard'
  if (s?.kind === 'toll') return 'toll'
  if (s?.kind === 'poi') return POI_ICON[s.poiKind] ?? 'place'
  return 'place'
})
const distance = computed(() => {
  const s = selection.value
  return s && pos.value.lngLat ? haversine(pos.value.lngLat, [s.lon, s.lat]) : null
})
const hours = computed(() => {
  const s = selection.value
  const v = details.value?.openingHours
  return s && v ? hoursStatus(v, s.lat, s.lon) : null
})
const subtitle = computed(() => {
  const s = selection.value
  const parts: string[] = []
  if (s?.kind === 'place' && s.category) parts.push(s.category)
  if (details.value?.cuisine) parts.push(details.value.cuisine.split(';').join(', '))
  if (distance.value != null) parts.push(`${formatDistance(distance.value)} từ bạn`)
  return parts.join(' · ')
})

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000)
  return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`
}

function left(until: number) {
  const m = Math.max(1, Math.round((until - Date.now()) / 60_000))
  return m < 60 ? `${m} phút` : m < 1440 ? `${Math.round(m / 60)} giờ` : `${Math.round(m / 1440)} ngày`
}

watch(selection, async (s) => {
  address.value = ''
  details.value = null
  error.value = ''
  shared.value = ''
  showWeek.value = showNearby.value = false
  photoOk.value = true
  if (!s) return
  $fetch<{ address: string }>('/api/geocode', { query: { lat: s.lat, lon: s.lon } })
    .then((r) => { if (selection.value === s) address.value = r.address })
    .catch(() => {})
  if (s.kind !== 'place') return
  detailsLoading.value = true
  try {
    const d = await $fetch<PlaceDetails | null>('/api/place', { query: { lat: s.lat, lon: s.lon, name: s.name } })
    if (selection.value === s) details.value = d
  } catch {} finally {
    if (selection.value === s) detailsLoading.value = false
  }
})

function placeOf() {
  const s = selection.value!
  return { name: title.value || `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`, address: details.value?.address ?? address.value, lat: s.lat, lon: s.lon }
}

function directions() {
  nav.value.destination = placeOf()
  selection.value = null
  plan()
}

async function share() {
  const s = selection.value!
  const url = `${location.origin}/?p=${s.lat.toFixed(6)},${s.lon.toFixed(6)}&n=${encodeURIComponent(title.value)}`
  try {
    if (navigator.share) await navigator.share({ title: title.value, text: title.value, url })
    else {
      await navigator.clipboard.writeText(url)
      shared.value = 'Đã sao chép liên kết'
    }
  } catch {}
}

function nearby(cat: NearbyCategory) {
  const s = selection.value!
  selection.value = null
  search(cat, [s.lon, s.lat])
}

async function run(fn: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try {
    await fn()
    selection.value = null
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Không thực hiện được, thử lại sau'
  } finally {
    busy.value = false
  }
}

function centre() {
  const s = selection.value
  if (s) map.value?.easeTo({ center: [s.lon, s.lat], zoom: Math.max(16, map.value.getZoom()) })
}

const website = computed(() => {
  const w = details.value?.website
  return w ? (/^https?:\/\//.test(w) ? w : `https://${w}`) : null
})
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

</script>

<template>
  <div v-if="selection" class="card pointer-events-auto max-h-[62vh] overflow-auto px-3.5 pb-3" :class="isPlace ? 'pt-0' : 'pt-3'">
    <div v-if="isPlace && details?.photo && photoOk" class="relative -mx-3.5 h-[170px] overflow-hidden rounded-t-card bg-bg-2">
      <img :src="details.photo" :alt="title" loading="lazy" class="block size-full object-cover" @error="photoOk = false">
      <span class="absolute right-1.5 bottom-1 text-[10px] text-white [text-shadow:0_1px_2px_#000]">Ảnh: Wikimedia Commons</span>
    </div>

    <div class="flex items-center gap-2" :class="{ 'pt-3': isPlace }">
      <button v-if="!isPlace" type="button" class="grid size-10 flex-none cursor-pointer place-items-center rounded-full border-0 bg-primary/12 text-primary" aria-label="Xem trên bản đồ" @click="centre">
        <AppIcon :name="icon" :size="22" />
      </button>
      <div class="min-w-0 flex-1">
        <div class="cursor-pointer text-lg font-bold" @click="centre">{{ title }}</div>
        <div class="text-[13px] text-muted">{{ subtitle }}</div>
        <div v-if="hours" class="text-[13px] font-semibold" :class="hours.open ? 'text-ok' : 'text-danger'">{{ hours.text }}</div>
      </div>
      <Button :icon="ICON.close" text rounded severity="secondary" aria-label="Đóng" @click="selection = null" />
    </div>

    <!-- Google-Maps-like action row -->
    <div v-if="isPlace" class="mt-3 mb-1 flex justify-around gap-1 border-b border-line pb-2.5">
      <IconAction icon="directions" label="Đường đi" primary :disabled="nav.active" @click="directions" />
      <IconAction :icon="isSaved(placeOf()) ? 'saved' : 'save'" :label="isSaved(placeOf()) ? 'Đã lưu' : 'Lưu'" :active="isSaved(placeOf())" @click="toggle(placeOf())" />
      <IconAction icon="nearby" label="Gần đó" :active="showNearby" @click="showNearby = !showNearby" />
      <IconAction icon="share" label="Chia sẻ" @click="share" />
    </div>
    <div v-if="shared" class="text-center text-[13px] text-ok">{{ shared }}</div>
    <div v-if="showNearby" class="my-2 flex flex-wrap gap-1.5">
      <Button
        v-for="c in NEARBY_CATEGORIES" :key="c.id" :label="c.label" :icon="ICON[c.icon]"
        rounded outlined size="small" severity="secondary" class="text-[13px]" @click="nearby(c.id)"
      />
    </div>

    <div v-if="report" class="mt-2 text-[13px]">
      <div v-if="report.note">“{{ report.note }}”</div>
      <div class="text-muted">
        Báo {{ ago(report.createdAt) }} · tự ẩn sau {{ left(report.expiresAt) }}
        <template v-if="report.goneVotes"> · {{ report.goneVotes }} người báo đã hết</template>
      </div>
    </div>
    <div v-else-if="toll" class="mt-2 text-[13px]">
      <b>{{ toll.price != null ? formatVnd(toll.price) : 'Chưa có giá' }}</b>
      <span v-if="toll.source" class="text-muted"> · nguồn {{ toll.source.date }}</span>
    </div>

    <ul
      v-if="isPlace"
      class="mt-2 mb-0 list-none p-0 text-[13px] [&_a]:break-all [&_a]:text-accent [&_a]:no-underline [&>li]:flex [&>li]:items-start [&>li]:gap-3 [&>li]:py-2 [&>li>.app-row-icon]:mt-px [&>li>.app-row-icon]:text-lg [&>li>.app-row-icon]:text-muted"
    >
      <li v-if="details?.address || address"><AppIcon name="place" class="app-row-icon" /><span>{{ details?.address || address }}</span></li>
      <li v-if="hours?.week.length" class="cursor-pointer" @click="showWeek = !showWeek">
        <AppIcon name="hours" class="app-row-icon" />
        <span>
          <span class="font-semibold" :class="hours.open ? 'text-ok' : 'text-danger'">{{ hours.text }}</span> {{ showWeek ? '▴' : '▾' }}
          <table v-if="showWeek" class="mt-1.5 border-collapse [&_td]:py-0.5 [&_td]:pr-3.5 [&_td]:pl-0">
            <tr v-for="([d, h], i) in hours.week" :key="i" :class="{ 'font-bold': i === 0 }"><td>{{ d }}</td><td>{{ h }}</td></tr>
          </table>
        </span>
      </li>
      <li v-else-if="details?.openingHours && !hours"><AppIcon name="hours" class="app-row-icon" /><span>{{ details.openingHours }}</span></li>
      <li v-if="details?.phone"><AppIcon name="phone" class="app-row-icon" /><a :href="`tel:${details.phone.split(/[;,]/)[0]!.replace(/\s/g, '')}`">{{ details.phone }}</a></li>
      <li v-if="website"><AppIcon name="website" class="app-row-icon" /><a :href="website" target="_blank" rel="noopener">{{ hostOf(website) }}</a></li>
      <li v-if="details?.facebook"><AppIcon name="website" class="app-row-icon" /><a :href="details.facebook.startsWith('http') ? details.facebook : `https://facebook.com/${details.facebook}`" target="_blank" rel="noopener">Facebook</a></li>
      <li v-if="details?.email"><AppIcon name="email" class="app-row-icon" /><a :href="`mailto:${details.email}`">{{ details.email }}</a></li>
      <li v-if="details?.wheelchair === 'yes'"><AppIcon name="wheelchair" class="app-row-icon" /><span>Lối đi cho xe lăn</span></li>
      <li v-if="details?.internet && details.internet !== 'no'"><AppIcon name="wifi" class="app-row-icon" /><span>Có Wi-Fi</span></li>
      <li v-if="details?.description"><AppIcon name="info" class="app-row-icon" /><span>{{ details.description }}</span></li>
      <li><AppIcon name="coords" class="app-row-icon" /><span class="text-muted">{{ selection.lat.toFixed(5) }}, {{ selection.lon.toFixed(5) }}</span></li>
      <li v-if="detailsLoading" class="text-muted"><AppIcon name="spinner" class="app-row-icon animate-spin" /><span>Đang tải thông tin chi tiết…</span></li>
      <li v-else-if="details" class="pl-[30px] text-[11px] text-muted"><span>Dữ liệu © <a :href="`https://www.openstreetmap.org/${details.osm}`" target="_blank" rel="noopener">OpenStreetMap</a> – bạn có thể bổ sung giờ mở cửa, số điện thoại tại đó</span></li>
    </ul>
    <div v-else-if="address" class="mt-1.5 truncate text-[13px] text-muted">{{ address }}</div>

    <div v-if="!isPlace" class="mt-2.5 flex items-center gap-2 empty:hidden">
      <template v-if="report">
        <Button
          v-if="isMine(report.id)" severity="danger" :icon="ICON.delete" label="Xoá báo cáo của tôi"
          class="min-w-0 flex-1" :loading="busy" @click="run(() => removeReport(report!.id))"
        />
        <Button
          v-else severity="secondary" :icon="hasVoted(report.id) ? ICON.check : ICON.thanks"
          :label="hasVoted(report.id) ? 'Đã báo là hết' : 'Không còn nữa'"
          class="min-w-0 flex-1" :disabled="busy || hasVoted(report.id)" @click="run(() => markGone(report!.id))"
        />
      </template>
      <Button v-else-if="!nav.active" :icon="ICON.directions" label="Chỉ đường" class="min-w-0 flex-1" @click="directions" />
    </div>
    <Message v-if="error" severity="error" size="small" variant="simple" class="my-[13px]">{{ error }}</Message>
  </div>
</template>
