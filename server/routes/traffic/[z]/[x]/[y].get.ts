/**
 * Proxy for TomTom Traffic Flow vector tiles (real-time, covers Vietnam).
 * Keeps the API key on the server and caches each tile for 60 s so many users
 * looking at the same area share one upstream request.
 * Free tier: 200k vector tile requests / month – https://developer.tomtom.com
 */
export default defineEventHandler(async (event) => {
  const key = useRuntimeConfig().tomtomKey
  if (!key) throw createError({ statusCode: 404, statusMessage: 'Traffic disabled (NUXT_TOMTOM_KEY not set)' })

  const z = Number(getRouterParam(event, 'z'))
  const x = Number(getRouterParam(event, 'x'))
  const y = parseInt(getRouterParam(event, 'y') ?? '')
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 22) throw createError({ statusCode: 400 })

  const url = `https://api.tomtom.com/traffic/map/4/tile/flow/relative/${z}/${x}/${y}.pbf?key=${key}&roadTypes=[0,1,2,3,4,5,6]`
  const tile = await cached(`traffic:${z}/${x}/${y}`, 60_000, async () => {
    const res = await fetch(url)
    if (res.status === 204 || res.status === 404) return new Uint8Array()
    if (!res.ok) throw createError({ statusCode: 502, statusMessage: `TomTom ${res.status}` })
    return new Uint8Array(await res.arrayBuffer())
  })

  setHeader(event, 'Content-Type', 'application/x-protobuf')
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return tile
})
