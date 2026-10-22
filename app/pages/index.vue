<script setup lang="ts">
import type { LngLat } from '#shared/types'
import TollPanel from '~/components/panel/TollPanel.vue'
import ViolationPanel from '~/components/panel/ViolationPanel.vue'
import GroupPanel from '~/components/panel/GroupPanel.vue'
import TirePanel from '~/components/panel/TirePanel.vue'
import CamsPanel from '~/components/panel/CamsPanel.vue'
import OfflinePanel from '~/components/panel/OfflinePanel.vue'
import SettingsPanel from '~/components/panel/SettingsPanel.vue'
import ReportPanel from '~/components/panel/ReportPanel.vue'

const PANELS: Record<string, Component> = {
  toll: TollPanel, violation: ViolationPanel, group: GroupPanel, tires: TirePanel,
  cams: CamsPanel, offline: OfflinePanel, settings: SettingsPanel, report: ReportPanel,
}

const { pos, startGps } = usePosition()
const { nav, plan, restoreOffline } = useNavigation()
const { map, follow, pickMode } = useMap()
const { register } = useOffline()
const settings = useSettings()
const isDark = useIsDark()
const searchActive = useState<'origin' | 'destination' | null>('searchActive', () => null)
const online = useOnline()
const trafficEnabled = useState('trafficEnabled', () => false)
useAlerts()
useGroup()

/** round map buttons on the right; larger in car mode */
// off-state (secondary) fabs sit on the map: give them the card surface so they stay visible in both themes
const FAB = '[&.p-button-secondary]:border-transparent! [&.p-button-secondary]:bg-bg! [&.p-button-secondary]:text-fg! [&.p-button-secondary]:hover:bg-bg-2! shadow-card! size-12! in-[.car]:size-15! in-[.car]:text-[26px] text-xl [&_.p-button-icon]:text-xl in-[.car]:[&_.p-button-icon]:text-[26px]'

const menu = ref(false)
const panel = ref<string | null>(null)
const carMode = ref(false)
let wakeLock: any = null

function open(p: string) {
  menu.value = false
  panel.value = p
}

async function placeAt(p: LngLat) {
  const fallback = { name: `${p[1].toFixed(5)}, ${p[0].toFixed(5)}`, lat: p[1], lon: p[0] }
  try {
    const r = await $fetch<{ name: string; address: string }>('/api/geocode', { query: { lat: p[1], lon: p[0] } })
    return { ...fallback, name: r.name || fallback.name, address: r.address }
  } catch {
    return fallback
  }
}

async function onPick(kind: 'origin' | 'destination', p: LngLat) {
  const place = await placeAt(p)
  nav.value[kind] = place
  if (nav.value.destination) plan()
}

async function onLongPress(p: LngLat) {
  if (nav.value.active) return
  nav.value.destination = await placeAt(p)
  plan()
}

function locate() {
  follow.value = true
  const p = pos.value.lngLat
  if (p) map.value?.easeTo({ center: p, zoom: Math.max(15, map.value.getZoom()) })
  else startGps()
}

async function toggleCarMode() {
  menu.value = false
  carMode.value = !carMode.value
  try {
    if (carMode.value) {
      await document.documentElement.requestFullscreen?.()
      wakeLock = await (navigator as any).wakeLock?.request('screen')
    } else {
      if (document.fullscreenElement) await document.exitFullscreen()
      await wakeLock?.release()
      wakeLock = null
    }
  } catch {}
}

// keep the screen on while navigating
watch(() => nav.value.active, async (a) => {
  try {
    if (a && !wakeLock) wakeLock = await (navigator as any).wakeLock?.request('screen')
    else if (!a && !carMode.value) { await wakeLock?.release(); wakeLock = null }
  } catch {}
})

// centre on first GPS fix
const stopFirstFix = watch(() => pos.value.lngLat, (p) => {
  if (!p || !map.value) return
  map.value.jumpTo({ center: p, zoom: 15 })
  stopFirstFix()
})

const wide = useState('wideScreen', () => window.matchMedia('(min-width: 900px)').matches)
const selection = useSelection()

// a shared place link (or a tapped place) names the tab / bookmark: "Bảo tàng Hà Nội · DLiMap"
useHead(() => (selection.value?.kind === 'place' ? { title: `${selection.value.name} · DLiMap` } : {}))

onMounted(() => {
  startGps()
  register()
  if (!online.value) restoreOffline()
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => (wide.value = e.matches))
  openSharedPlace()
})

/** Links from "Chia sẻ": /?p=lat,lon&n=name open that place. */
function openSharedPlace() {
  const q = new URLSearchParams(location.search)
  const [lat, lon] = (q.get('p') ?? '').split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
  follow.value = false
  stopFirstFix() // don't jump to the GPS position over the shared place
  selection.value = { kind: 'place', name: q.get('n') || `${lat!.toFixed(5)}, ${lon!.toFixed(5)}`, lat: lat!, lon: lon! }
  // the map is created asynchronously (after its style is fetched) – wait for it
  let done = false
  watch(map, (m) => {
    if (!m || done) return
    done = true
    const go = () => m.jumpTo({ center: [lon!, lat!], zoom: 16 })
    if (m.loaded()) go()
    else m.once('load', go)
  }, { immediate: true })
  history.replaceState(null, '', location.pathname)
}
</script>

<template>
  <main class="fixed inset-0" :class="{ car: carMode, nav: nav.active }">
    <!-- the page's heading for search engines and screen readers (the map is the visible content) -->
    <h1 class="sr-only">DLiMap · Bản đồ, dẫn đường &amp; cảnh báo giao thông</h1>
    <MapView @pick="onPick" @longpress="onLongPress" />

    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex max-w-[480px] flex-col gap-2 px-2.5 pt-[calc(env(safe-area-inset-top)+10px)] min-[900px]:left-2.5 min-[900px]:pl-0">
      <NavBanner v-if="nav.active" />
      <SearchBar v-else @menu="menu = true" />
      <CategoryChips v-if="!nav.active && !nav.routes.length && !searchActive" />
      <Message v-if="pickMode" severity="info" class="pointer-events-auto shadow-card" :pt="{ text: { class: 'flex flex-1 items-center gap-1.5 text-[13px]' } }">
        <span class="flex-1">Chạm vào bản đồ để chọn {{ pickMode === 'origin' ? 'điểm đi' : 'điểm đến' }}</span>
        <Button label="Huỷ" text size="small" @click="pickMode = null" />
      </Message>
      <Message v-if="!online" severity="warn" class="pointer-events-auto shadow-card" :pt="{ text: { class: 'text-[13px]' } }" :icon="ICON.offline">Mất kết nối – chế độ Hybrid đang hoạt động</Message>
      <Message v-if="pos.error" severity="secondary" class="pointer-events-auto shadow-card" :pt="{ text: { class: 'text-[13px]' } }" :icon="ICON.place">{{ pos.error }}. Bạn vẫn có thể tìm đường và dùng “Mô phỏng”.</Message>
      <AlertStack />
      <!-- wide screens: place details in a left column, like Google Maps -->
      <template v-if="wide && !nav.active">
        <PlaceCard />
        <NearbyList />
      </template>
    </div>

    <div class="absolute top-1/2 right-2.5 z-10 flex -translate-y-1/2 flex-col gap-2.5">
      <Button v-if="nav.active" rounded raised severity="secondary" :icon="ICON.menu" :class="FAB" title="Menu" aria-label="Menu" @click="menu = true" />
      <Button rounded raised :severity="follow ? undefined : 'secondary'" :icon="ICON.myLocation" :class="FAB" title="Vị trí của tôi" aria-label="Vị trí của tôi" @click="locate" />
      <Button v-if="trafficEnabled" rounded raised :severity="settings.showTraffic ? undefined : 'secondary'" :class="FAB" title="Tình trạng giao thông (TomTom, thời gian thực)" aria-label="Tình trạng giao thông" :icon="ICON.traffic" @click="settings.showTraffic = !settings.showTraffic" />
      <Button rounded raised severity="secondary" :icon="isDark ? ICON.lightMode : ICON.darkMode" :class="FAB" :title="isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'" :aria-label="isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'" @click="settings.theme = isDark ? 'light' : 'dark'" />
      <Button rounded raised severity="secondary" :icon="ICON.report" :class="FAB" title="Báo cáo" aria-label="Báo cáo" @click="open('report')" />
      <Button rounded raised :severity="carMode ? undefined : 'secondary'" :icon="ICON.carMode" :class="FAB" title="Chế độ lái xe" aria-label="Chế độ lái xe" @click="toggleCarMode" />
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex max-w-[520px] flex-col gap-2 px-2.5 pb-[calc(env(safe-area-inset-bottom)+28px)]">
      <SpeedHud />
      <template v-if="!wide || nav.active">
        <PlaceCard />
        <NearbyList />
      </template>
      <RouteSheet @open="open" />
    </div>

    <SideMenu v-if="menu" @close="menu = false" @open="open" @carmode="toggleCarMode" />
    <component :is="PANELS[panel]" v-if="panel && PANELS[panel]" @close="panel = null" />
  </main>
</template>
