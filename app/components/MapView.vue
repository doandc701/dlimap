<script setup lang="ts">
import { Map as MlMap, Marker, ScaleControl, setWorkerUrl } from 'maplibre-gl'
// maplibre resolves its worker relative to its own module, which breaks once Vite bundles it
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { GeoJSONSource, MapGeoJSONFeature, MapLayerMouseEvent, MapMouseEvent, MapTouchEvent, PointLike } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { LngLat } from '#shared/types'

setWorkerUrl(workerUrl)

const emit = defineEmits<{ pick: [kind: 'origin' | 'destination', p: LngLat]; longpress: [p: LngLat] }>()

const el = ref<HTMLDivElement>()
const config = useRuntimeConfig()
const isDark = useIsDark()
const settings = useSettings()
const { map, follow, pickMode } = useMap()
const selection = useSelection()
const trafficSummary = useTrafficSummary()
const mapReady = useState('mapReady', () => false)
const { state: nearbyState } = useNearby()
const { pos } = usePosition()
const { nav, route, selectRoute } = useNavigation()
const trafficEnabled = useState('trafficEnabled', () => false)
const { nearby, reports } = useRoad()
const { others } = useGroup()

/** Map marker per feature kind: Material Symbols glyph (same set as the UI) and its colour. */
const MARKERS: Record<string, [IconName, string]> = {
  speed_camera: [POI_ICON.speed_camera!, '#e02424'],
  red_light_camera: [POI_ICON.red_light_camera!, '#b91c1c'],
  traffic_signals: [POI_ICON.traffic_signals!, '#334155'],
  no_overtaking: [POI_ICON.no_overtaking!, '#e02424'],
  tunnel: [POI_ICON.tunnel!, '#475569'],
  surveillance: [POI_ICON.surveillance!, '#0369a1'],
  toll: [POI_ICON.toll!, '#0b5fff'],
  'report:camera': [REPORT_ICON.camera!, '#ea580c'],
  'report:police': [REPORT_ICON.police!, '#1d4ed8'],
  'report:accident': [REPORT_ICON.accident!, '#dc2626'],
  'report:jam': [REPORT_ICON.jam!, '#d97706'],
  'report:hazard': [REPORT_ICON.hazard!, '#ca8a04'],
}

/** White disc, coloured ring and glyph, drawn at 2× for crisp markers. */
async function markerImage(icon: IconName, color: string): Promise<ImageData> {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  g.beginPath()
  g.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
  g.lineWidth = 5
  g.strokeStyle = color
  g.stroke()
  const svg = MAP_ICON_SVG[icon]
  if (svg) {
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replaceAll('currentColor', color))}`
    await img.decode()
    const size = 36
    g.drawImage(img, (s - size) / 2, (s - size) / 2, size, size)
  }
  return g.getImageData(0, 0, s, s)
}

/** All marker images, prepared once before the map is created (addImage needs them synchronously). */
let markerImages: Promise<Record<string, ImageData>> | undefined
function loadMarkerImages() {
  return (markerImages ??= Promise.all(Object.entries(MARKERS).map(async ([k, [icon, color]]) => [k, await markerImage(icon, color)] as const))
    .then(Object.fromEntries))
}
let markers: Record<string, ImageData> = {}

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

function setData(id: string, data: FeatureCollection) {
  ;(map.value?.getSource(id) as GeoJSONSource | undefined)?.setData(data)
}

/** Prefer Vietnamese place names on the base map. */
function localizeLabels(m: MlMap) {
  for (const l of m.getStyle().layers) {
    if (l.type !== 'symbol' || l.id.includes('shield')) continue
    const tf = m.getLayoutProperty(l.id, 'text-field')
    if (tf && JSON.stringify(tf).includes('name')) m.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:vi'], ['get', 'name']])
  }
}

/** First label layer of the base style: everything after the last non-symbol layer (3D buildings etc.). */
function labelsStart(m: MlMap): string | undefined {
  const layers = m.getStyle().layers
  let last = -1
  layers.forEach((l, i) => { if (l.type !== 'symbol' && !OUR_LAYERS.has(l.id)) last = i })
  return layers[last + 1]?.id
}
const OUR_LAYERS = new Set(['alts', 'route-casing', 'route', 'traffic', 'pois', 'tolls', 'search-dot', 'search'])

function addLayers(m: MlMap) {
  localizeLabels(m)
  for (const [k, img] of Object.entries(markers)) if (!m.hasImage(`ic-${k}`)) m.addImage(`ic-${k}`, img, { pixelRatio: 2 })
  for (const id of ['alts', 'route', 'pois', 'tolls', 'search']) if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: empty })

  // lines go under the base map's labels (like Google Maps), so road names stay readable
  const below = labelsStart(m)
  m.addLayer({ id: 'alts', type: 'line', source: 'alts', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8aa0c0', 'line-width': 7, 'line-opacity': 0.8 } }, below)
  m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0a3fb0', 'line-width': 11 } }, below)
  m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2f7bff', 'line-width': 7 } }, below)
  addTrafficLayer(m)
  m.addLayer({
    id: 'pois', type: 'symbol', source: 'pois',
    layout: {
      'icon-image': ['concat', 'ic-', ['get', 'kind']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 0.9],
      'icon-allow-overlap': true,
      'symbol-sort-key': ['get', 'rank'],
    },
    filter: ['any', ['!=', ['get', 'kind'], 'traffic_signals'], ['>=', ['zoom'], 14]],
  })
  m.addLayer({
    id: 'tolls', type: 'symbol', source: 'tolls',
    layout: {
      'icon-image': 'ic-toll', 'icon-size': 0.9, 'icon-allow-overlap': true,
      'text-field': ['get', 'label'], 'text-font': FONT.medium, 'text-size': 12, 'text-offset': [0, 1.8], 'text-anchor': 'top',
    },
    paint: isDark.value
      ? { 'text-color': '#8db4ff', 'text-halo-color': '#111827', 'text-halo-width': 2 }
      : { 'text-color': '#0b5fff', 'text-halo-color': '#fff', 'text-halo-width': 2 },
  })

  m.addLayer({
    id: 'search-dot', type: 'circle', source: 'search',
    paint: { 'circle-radius': 7, 'circle-color': '#e02424', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
  })
  m.addLayer({
    id: 'search', type: 'symbol', source: 'search',
    layout: { 'text-field': ['get', 'name'], 'text-font': FONT.medium, 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
    paint: { 'text-color': '#c81e1e', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
  })
  syncAll()
}

// ---------- tapping features (like Google Maps) ----------
const OWN_LAYERS = ['search-dot', 'search', 'pois', 'tolls']
const BASE_SOURCE_LAYERS = ['poi', 'aerodrome_label', 'mountain_peak']

/** Topmost tappable feature under the pointer: our markers first, then base-map POIs. */
function featureAt(m: MlMap, p: { x: number; y: number }): MapGeoJSONFeature | undefined {
  const box: [PointLike, PointLike] = [[p.x - 8, p.y - 8], [p.x + 8, p.y + 8]]
  const own = m.queryRenderedFeatures(box, { layers: OWN_LAYERS.filter((l) => m.getLayer(l)) })
  if (own[0]) return own[0]
  return m.queryRenderedFeatures(box).find((f) => BASE_SOURCE_LAYERS.includes(f.sourceLayer ?? '') && (f.properties['name:vi'] || f.properties.name))
}

function toSelection(f: MapGeoJSONFeature, at: LngLat): MapSelection {
  const pt = f.geometry.type === 'Point' ? (f.geometry.coordinates as LngLat) : at
  const props = f.properties
  if (f.layer.id === 'search' || f.layer.id === 'search-dot') {
    return { kind: 'place', name: props.name, category: NEARBY_CATEGORIES.find((c) => c.id === props.cat)?.label, lon: pt[0], lat: pt[1] }
  }
  if (f.layer.id === 'tolls') return { kind: 'toll', id: props.id, lon: pt[0], lat: pt[1] }
  if (f.layer.id === 'pois') {
    if (String(props.kind).startsWith('report:')) return { kind: 'report', id: props.id, lon: pt[0], lat: pt[1] }
    return { kind: 'poi', poiKind: props.kind, title: props.title, name: props.name || undefined, lon: pt[0], lat: pt[1] }
  }
  return {
    kind: 'place',
    name: props['name:vi'] || props.name,
    category: poiCategory(String(props.class ?? ''), String(props.subclass ?? ''), f.sourceLayer),
    lon: pt[0], lat: pt[1],
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const TITLES: Record<string, string> = {
  speed_camera: 'Camera tốc độ', red_light_camera: 'Camera đèn đỏ', traffic_signals: 'Đèn giao thông',
  no_overtaking: 'Cấm vượt', tunnel: 'Hầm chui', surveillance: 'Camera giám sát giao thông',
  'report:camera': 'Camera (cộng đồng)', 'report:police': 'CSGT', 'report:accident': 'Tai nạn', 'report:jam': 'Kẹt xe', 'report:hazard': 'Nguy hiểm',
}

// ---------- data sync ----------
function syncRoutes() {
  const routes = nav.value.routes
  setData('alts', {
    type: 'FeatureCollection',
    features: routes.map((r, i): Feature => ({ type: 'Feature', properties: { index: i }, geometry: { type: 'LineString', coordinates: r.geometry } }))
      .filter((_, i) => i !== nav.value.selected),
  })
  // walking routes are dotted, as in Google Maps
  const m = map.value
  if (m?.getLayer('route')) {
    const foot = route.value?.mode === 'foot'
    m.setPaintProperty('route', 'line-dasharray', foot ? [0, 1.6] : undefined)
    m.setPaintProperty('route-casing', 'line-opacity', foot ? 0 : 1)
  }
  setData('route', route.value
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.value.geometry } }] }
    : empty)
}

/**
 * Real-time traffic (TomTom, proxied by /traffic/{z}/{x}/{y}). Drawn above the route
 * so the route itself shows its congestion. traffic_level = current / free-flow speed.
 */
function addTrafficLayer(m: MlMap) {
  if (!trafficEnabled.value || m.getLayer('traffic')) return
  m.addSource('traffic', { type: 'vector', tiles: [`${location.origin}/traffic/{z}/{x}/{y}`], minzoom: 6, maxzoom: 18 })
  m.addLayer({
    id: 'traffic', type: 'line', source: 'traffic', 'source-layer': 'Traffic flow',
    filter: ['!=', ['get', 'road_closure'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: settings.value.showTraffic ? 'visible' : 'none' },
    paint: {
      // Google-like: green unless clearly slower than usual (traffic_level = current / free-flow speed)
      'line-color': ['step', ['get', 'traffic_level'], '#8c1d18', 0.25, '#e8453c', 0.45, '#f4a622', 0.65, '#1ec67a'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 2.5, 15, 4.5, 18, 8],
      // only main roads when zoomed out, all roads close up
      'line-opacity': ['step', ['zoom'],
        ['match', ['get', 'road_type'], TRAFFIC_MAIN, 0.95, 0],
        13, ['match', ['get', 'road_type'], [...TRAFFIC_MAIN, ...TRAFFIC_CITY], 0.95, 0],
        15, 0.95],
    },
  }, labelsStart(m))
}

/** TomTom road classes (`road_type`) shown at each zoom. */
const TRAFFIC_MAIN = ['Motorway', 'International road', 'Major road', 'Secondary road']
const TRAFFIC_CITY = ['Connecting road', 'Major local road']

function syncTraffic() {
  const m = map.value
  if (!m?.getLayer('traffic')) return
  m.setLayoutProperty('traffic', 'visibility', settings.value.showTraffic ? 'visible' : 'none')
}

function syncPois() {
  const base = nav.value.routes.length ? nav.value.pois : nearby.value
  const feats: Feature[] = base.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, kind: p.kind, name: p.name ?? '', title: TITLES[p.kind] ?? p.kind, rank: p.kind === 'traffic_signals' ? 2 : 1 },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  }))
  for (const r of reports.value) {
    feats.push({ type: 'Feature', properties: { id: r.id, kind: `report:${r.type}`, name: r.note, title: TITLES[`report:${r.type}`], rank: 0 }, geometry: { type: 'Point', coordinates: [r.lon, r.lat] } })
  }
  setData('pois', { type: 'FeatureCollection', features: feats })
  setData('tolls', {
    type: 'FeatureCollection',
    features: nav.value.tolls.map((t) => ({ type: 'Feature', properties: { id: t.id, label: `${t.name}\n${t.price != null ? formatVnd(t.price) : 'chưa có giá'}` }, geometry: { type: 'Point', coordinates: [t.lon, t.lat] } })),
  })
}

function syncSearch() {
  setData('search', {
    type: 'FeatureCollection',
    features: nearbyState.value.items.map((p) => ({ type: 'Feature', properties: { name: p.name, cat: p.category }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
  })
}

function syncAll() {
  syncSearch()
  syncRoutes()
  syncTraffic()
  syncPois()
}

watch([() => nav.value.routes, () => nav.value.selected], syncRoutes)
watch(() => settings.value.showTraffic, syncTraffic)
watch(() => nearbyState.value.items, syncSearch)
// isStyleLoaded() is also false while icons/tiles are still loading, so track style.load
// ourselves; otherwise the traffic layer could be skipped if the status arrives in between
let styleReady = false
watch(trafficEnabled, (on) => { if (on && styleReady && map.value) addTrafficLayer(map.value) })
watch([() => nav.value.pois, () => nav.value.tolls, nearby, reports, () => nav.value.routes.length], syncPois, { deep: true })

// ---------- user & group markers ----------
let userMarker: Marker | null = null
let destMarker: Marker | null = null
const groupMarkers = new Map<string, Marker>()

function userEl() {
  const d = document.createElement('div')
  d.className = 'user-marker'
  d.innerHTML = '<div class="pulse"></div><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#0b5fff" stroke="#fff" stroke-width="3"/><path d="M20 8 29 29 20 24 11 29Z" fill="#fff"/></svg>'
  return d
}

watch(() => [pos.value.lngLat, pos.value.heading] as const, ([p, h]) => {
  const m = map.value
  if (!m || !p) return
  if (!userMarker) userMarker = new Marker({ element: userEl(), rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(p).addTo(m)
  userMarker.setLngLat(nav.value.active && nav.value.progress && !nav.value.progress.offRoute ? nav.value.progress.point : p)
  userMarker.setRotation(h)
  if (follow.value) {
    const navigating = nav.value.active
    m.easeTo({
      center: p,
      bearing: navigating ? h : m.getBearing(),
      pitch: navigating ? 55 : m.getPitch(),
      zoom: navigating ? (pos.value.speed > 70 ? 15.5 : pos.value.speed > 40 ? 16.3 : 17) : Math.max(m.getZoom(), 14),
      offset: navigating ? [0, 120] : [0, 0],
      duration: 600,
      essential: true,
    })
  }
})

watch(() => nav.value.destination, (d) => {
  destMarker?.remove()
  destMarker = null
  if (d && map.value) destMarker = new Marker({ color: '#e02424' }).setLngLat([d.lon, d.lat]).addTo(map.value)
})

watch(others, (list) => {
  const m = map.value
  if (!m) return
  const ids = new Set(list.map((x) => x.id))
  for (const [id, mk] of groupMarkers) if (!ids.has(id)) { mk.remove(); groupMarkers.delete(id) }
  for (const g of list) {
    let mk = groupMarkers.get(g.id)
    if (!mk) {
      const d = document.createElement('div')
      d.className = 'group-marker'
      mk = new Marker({ element: d }).setLngLat([g.lon, g.lat]).addTo(m)
      groupMarkers.set(g.id, mk)
    }
    const d = mk.getElement()
    d.style.setProperty('--c', g.color)
    d.innerHTML = `<span class="dot"></span><span class="lbl">${escapeHtml(g.name)} · ${g.speed} km/h</span>`
    mk.setLngLat([g.lon, g.lat])
  }
}, { deep: true })

// ---------- lifecycle ----------
const styleFor = (dark: boolean) => resolveMapStyle(dark, config.public.mapStyle, config.public.mapStyleDark)

onMounted(async () => {
  markers = await loadMarkerImages().catch(() => ({}))
  $fetch<{ enabled: boolean }>('/api/traffic-status').then((r) => (trafficEnabled.value = r.enabled)).catch(() => {})
  const style = await Promise.resolve(styleFor(isDark.value)).catch(() => config.public.mapStyle)
  if (!el.value) return
  const m = new MlMap({
    container: el.value,
    style,
    center: [105.8542, 21.0285],
    zoom: 12,
    attributionControl: { compact: true },
  })
  map.value = m
  m.addControl(new ScaleControl({ maxWidth: 90 }), 'bottom-left')
  m.on('style.load', () => {
    styleReady = true
    addLayers(m)
  })
  m.on('click', 'alts', (e: MapLayerMouseEvent) => {
    const i = e.features?.[0]?.properties?.index
    if (i != null) selectRoute(Number(i))
  })
  m.on('dragstart', () => (follow.value = false))
  m.on('idle', () => trafficSummary.update(m))
  // first complete render ends the page-load splash
  m.once('idle', () => (mapReady.value = true))
  m.on('click', (e: MapMouseEvent) => {
    if (pickMode.value) {
      emit('pick', pickMode.value, [e.lngLat.lng, e.lngLat.lat])
      pickMode.value = null
      return
    }
    const f = featureAt(m, e.point)
    selection.value = f ? toSelection(f, [e.lngLat.lng, e.lngLat.lat]) : null
  })
  m.on('mousemove', (e: MapMouseEvent) => {
    m.getCanvas().style.cursor = pickMode.value ? '' : featureAt(m, e.point) || m.queryRenderedFeatures(e.point, { layers: ['alts'].filter((l) => m.getLayer(l)) }).length ? 'pointer' : ''
  })
  m.on('contextmenu', (e: MapMouseEvent) => emit('longpress', [e.lngLat.lng, e.lngLat.lat]))
  // touch long-press
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  m.on('touchstart', (e: MapTouchEvent) => {
    if (e.originalEvent.touches.length !== 1) return
    pressTimer = setTimeout(() => emit('longpress', [e.lngLat.lng, e.lngLat.lat]), 650)
  })
  for (const ev of ['touchend', 'touchmove', 'touchcancel'] as const) m.on(ev, () => pressTimer && clearTimeout(pressTimer))
})

watch(isDark, async (d) => {
  const style = await Promise.resolve(styleFor(d)).catch(() => config.public.mapStyle)
  if (isDark.value === d) map.value?.setStyle(style)
})

onBeforeUnmount(() => {
  map.value?.remove()
  map.value = null
  userMarker = destMarker = null
  groupMarkers.clear()
})
</script>

<template>
  <div ref="el" class="absolute inset-0" :class="{ '[&_canvas]:cursor-crosshair!': pickMode }" />
</template>
