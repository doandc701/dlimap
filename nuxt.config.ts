import tailwindcss from '@tailwindcss/vite'

/** Public address of the site (canonical URL, link previews, sitemap). Override with NUXT_PUBLIC_SITE_URL. */
const SITE_URL = (process.env.NUXT_PUBLIC_SITE_URL || 'https://dlimap.vercel.app').replace(/\/$/, '')

/** Texts for search engines and link previews. */
const SEO = {
  title: 'DLiMap · Bản đồ, dẫn đường & cảnh báo giao thông',
  description: 'DLiMap: bản đồ và dẫn đường giọng nói tiếng Việt, cảnh báo tốc độ và camera phạt nguội, tình trạng kẹt xe thời gian thực, tính phí BOT và cao tốc, dẫn đường cả khi mất mạng. Miễn phí, chạy ngay trên trình duyệt.',
  short: 'Dẫn đường tiếng Việt, cảnh báo tốc độ & camera, kẹt xe thời gian thực, phí BOT – miễn phí trên trình duyệt.',
  features: [
    'Dẫn đường giọng nói tiếng Việt cho ô tô, xe máy, xe đạp, đi bộ',
    'Cảnh báo giới hạn tốc độ theo Thông tư 38/2024',
    'Cảnh báo camera phạt nguội, cấm vượt, hầm chui, đèn giao thông',
    'Tình trạng kẹt xe thời gian thực',
    'Tính phí BOT và phí cao tốc theo loại xe',
    'Dẫn đường ngoại tuyến (hybrid)',
    'Tìm nhà hàng, cây xăng, bãi đỗ xe quanh đây',
    'Báo cáo CSGT, tai nạn, kẹt xe cùng cộng đồng',
  ],
}

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
  // shown before the JavaScript loads; BootSplash.vue then continues with the same splash
  spaLoadingTemplate: 'spa-loading-template.html',
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
      title: SEO.title,
      htmlAttrs: { lang: 'vi' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: SEO.description },
        { name: 'keywords', content: 'bản đồ, dẫn đường, chỉ đường, cảnh báo tốc độ, camera phạt nguội, kẹt xe, tình trạng giao thông, phí BOT, phí cao tốc, ePass, VETC, Việt Nam' },
        { name: 'robots', content: 'index, follow, max-image-preview:large' },
        // Google Search Console ownership (same Google account as DLiMusic)
        { name: 'google-site-verification', content: '0ilO9pMWTcnIBrZ4eYZopNa-fXTCw2SUk1pJUD1PxdI' },
        { name: 'application-name', content: 'DLiMap' },
        { name: 'apple-mobile-web-app-title', content: 'DLiMap' },
        { name: 'theme-color', content: '#0b5fff', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#111827', media: '(prefers-color-scheme: dark)' },
        // link previews (Facebook, Zalo, Messenger, Slack…)
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'DLiMap' },
        { property: 'og:url', content: `${SITE_URL}/` },
        { property: 'og:title', content: SEO.title },
        { property: 'og:description', content: SEO.short },
        { property: 'og:image', content: `${SITE_URL}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'DLiMap – bản đồ, dẫn đường và cảnh báo giao thông' },
        { property: 'og:locale', content: 'vi_VN' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: SEO.title },
        { name: 'twitter:description', content: SEO.short },
        { name: 'twitter:image', content: `${SITE_URL}/og-image.png` },
      ],
      link: [
        { rel: 'canonical', href: `${SITE_URL}/` },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'icon', href: '/favicon-48.png', type: 'image/png', sizes: '48x48' },
        { rel: 'icon', href: '/favicon-96.png', type: 'image/png', sizes: '96x96' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        // the map style, tiles and glyphs come from here – start the connection early
        { rel: 'preconnect', href: 'https://tiles.openfreemap.org', crossorigin: '' },
      ],
      script: [
        // WebSite: the name Google shows above the result (instead of "Vercel")
        { type: 'application/ld+json', innerHTML: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'WebSite', 'name': 'DLiMap',
          'alternateName': ['DLi Map', SEO.title], 'url': `${SITE_URL}/`, 'inLanguage': 'vi',
        }) },
        { type: 'application/ld+json', innerHTML: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'WebApplication', 'name': 'DLiMap',
          'url': `${SITE_URL}/`, 'description': SEO.description,
          'applicationCategory': 'TravelApplication', 'operatingSystem': 'Web, iOS, Android',
          'browserRequirements': 'Requires JavaScript and WebGL', 'inLanguage': 'vi',
          'image': `${SITE_URL}/og-image.png`, 'screenshot': `${SITE_URL}/og-image.png`,
          'featureList': SEO.features,
          'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'VND' },
        }) },
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
      /** canonical address of the site (robots.txt, sitemap, share links); env NUXT_PUBLIC_SITE_URL */
      siteUrl: SITE_URL,
      mapStyle: 'https://tiles.openfreemap.org/styles/liberty',
      /** empty = night version derived from mapStyle (same layers as the light map) */
      mapStyleDark: '',
    },
  },
})
