import tailwindcss from '@tailwindcss/vite'

let devUrl: string | undefined
let serverBuilt = false

/** Handy URLs for manual testing, printed each time the dev server starts. */
function printTestLinks(base: string) {
  const enc = encodeURIComponent
  const links: [string, string][] = [
    ['Ứng dụng', `${base}/`],
    ['Mở địa điểm mẫu', `${base}/?p=21.010013,105.786309&n=${enc('Bảo tàng Hà Nội')}`],
    ['API giao thông (TomTom)', `${base}/api/traffic-status`],
    ['API tìm địa điểm', `${base}/api/geocode?q=${enc('Hồ Gươm')}`],
    ['API chi tiết địa điểm', `${base}/api/place?lat=21.010013&lon=105.786309&name=${enc('Bảo tàng Hà Nội')}`],
    ['API tuyến đường', `${base}/api/route?coords=105.8542,21.0285;105.7838,21.0170`],
    ['API bảng phí cao tốc', `${base}/api/tolls`],
    ['API báo cáo cộng đồng', `${base}/api/reports`],
  ]
  const w = Math.max(...links.map(([l]) => l.length))
  console.log(`\n  \x1b[1mLink test DLiMap\x1b[0m\n${links.map(([l, u]) => `  ➜ ${l.padEnd(w)}  \x1b[36m${u}\x1b[0m`).join('\n')}\n`)
}

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  // listen on (and show) 127.0.0.1: on this machine "localhost" resolves to ::1 first,
  // where nothing listens, so http://localhost:3000 fails with ERR_CONNECTION_RESET
  devServer: { host: '127.0.0.1' },
  modules: ['@primevue/nuxt-module'],
  primevue: {
    importTheme: { as: 'DLiMapTheme', from: '~/theme/primevue' },
    options: { ripple: false },
  },
  css: ['~/assets/main.css'],
  vite: {
    plugins: [tailwindcss()],
    // dev server reachable from phones through a tunnel (`npm run dev:share`), see README
    server: { allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.trycloudflare.com'] },
  },
  hooks: {
    // `npm run dev`: print ready-to-click test links once the server is listening AND built
    listen(_server, listener) {
      const url = listener.url.replace(/\/$/, '')
      devUrl = url
      if (serverBuilt) printTestLinks(url)
    },
    'nitro:init'(nitro) {
      nitro.hooks.hookOnce('compiled', () => {
        serverBuilt = true
        if (devUrl) setTimeout(() => printTestLinks(devUrl!), 100)
      })
    },
  },
  app: {
    head: {
      title: 'DLiMap – Trợ lý giao thông',
      htmlAttrs: { lang: 'vi' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0b5fff' },
        { name: 'description', content: 'DLiMap – cảnh báo tốc độ, camera, tính phí BOT, dẫn đường hybrid.' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
  runtimeConfig: {
    osrmUrl: 'https://router.project-osrm.org',
    /** OSRM servers with bicycle / foot profiles */
    osrmBikeUrl: 'https://routing.openstreetmap.de/routed-bike',
    osrmFootUrl: 'https://routing.openstreetmap.de/routed-foot',
    /** Valhalla for motorbikes (respects motorcycle=no, i.e. stays off expressways) */
    valhallaUrl: 'https://valhalla1.openstreetmap.de',
    nominatimUrl: 'https://nominatim.openstreetmap.org',
    overpassUrl: 'https://overpass-api.de/api/interpreter',
    /** TomTom API key for real-time traffic (env NUXT_TOMTOM_KEY); traffic is hidden when empty */
    tomtomKey: '',
    public: {
      mapStyle: 'https://tiles.openfreemap.org/styles/liberty',
      /** empty = night version derived from mapStyle (same layers as the light map) */
      mapStyleDark: '',
    },
  },
})
