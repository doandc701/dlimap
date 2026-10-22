/* DLiMap service worker – caches map tiles & app shell for hybrid (offline) navigation. */
const DEV = new URL(self.location).searchParams.has('dev')
const SHELL = 'dlimap-shell-v1'
const TILES = 'dlimap-tiles'
const API = 'dlimap-api-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

async function cacheFirst(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

async function networkFirst(req, name) {
  const cache = await caches.open(name)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' })
    if (hit) return hit
    if (req.mode === 'navigate') {
      const shell = await cache.match('/')
      if (shell) return shell
    }
    throw err
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // vector tiles, fonts and sprites never change for a given URL
  if (url.hostname === 'tiles.openfreemap.org') {
    if (/\.(pbf|png|webp)$/.test(url.pathname) || url.pathname.includes('/fonts/')) return e.respondWith(cacheFirst(req, TILES))
    return e.respondWith(networkFirst(req, TILES)) // style.json / tilejson
  }

  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/road') || url.pathname.startsWith('/api/geocode') || url.pathname.startsWith('/api/route')) {
    return e.respondWith(networkFirst(req, API))
  }
  if (DEV) return
  if (url.pathname.startsWith('/_nuxt/') || req.mode === 'navigate' || url.pathname === '/manifest.webmanifest') {
    return e.respondWith(networkFirst(req, SHELL))
  }
})
