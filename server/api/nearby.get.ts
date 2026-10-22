import type { NearbyCategory, NearbyPlace } from '#shared/types'

/** OSM filters behind each category chip. */
const FILTERS: Record<NearbyCategory, string[]> = {
  restaurant: ['[amenity~"^(restaurant|fast_food|food_court)$"]'],
  cafe: ['[amenity~"^(cafe|ice_cream)$"]'],
  hotel: ['[tourism~"^(hotel|motel|guest_house|hostel|apartment)$"]'],
  attraction: ['[tourism~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"]', '[historic~"^(monument|memorial|temple|castle)$"]'],
  transit: ['[highway=bus_stop]', '[railway~"^(station|halt)$"]', '[public_transport=station]', '[railway=subway_entrance]'],
  parking: ['[amenity~"^(parking|motorcycle_parking)$"]'],
  fuel: ['[amenity=fuel]', '[amenity=charging_station]'],
  pharmacy: ['[amenity=pharmacy]', '[healthcare=pharmacy]'],
  atm: ['[amenity~"^(atm|bank)$"]'],
  hospital: ['[amenity~"^(hospital|clinic|doctors)$"]'],
}

/** Places of one category around a point, nearest first (named places only). */
export default defineEventHandler(async (event): Promise<NearbyPlace[]> => {
  const q = getQuery(event)
  const cat = String(q.cat) as NearbyCategory
  const lat = Number(q.lat), lon = Number(q.lon)
  const radius = Math.min(3000, Math.max(200, Number(q.r) || 1500))
  if (!FILTERS[cat] || !Number.isFinite(lat) || !Number.isFinite(lon)) throw createError({ statusCode: 400 })

  // ~100 m grid so neighbouring searches share the cache
  const la = lat.toFixed(3), lo = lon.toFixed(3)
  const parts = FILTERS[cat].map((f) => `nwr(around:${radius},${la},${lo})${f}[name];`).join('')
  const query = `[out:json][timeout:25];(${parts});out tags center 300;`
  let els
  try {
    els = await cached(`nearby:${query}`, 3600_000, () => overpass(query))
  } catch {
    return fromNominatim(cat, lat, lon, radius)
  }

  const out: (NearbyPlace & { d: number })[] = []
  for (const e of els) {
    const c = e.lat != null ? { lat: e.lat, lon: e.lon! } : (e as any).center
    const t = e.tags ?? {}
    if (!c || !(t['name:vi'] ?? t.name)) continue
    out.push({
      id: `${e.type}/${e.id}`,
      name: t['name:vi'] ?? t.name!,
      lat: c.lat, lon: c.lon, category: cat,
      kind: t.cuisine ?? t.amenity ?? t.tourism ?? t.historic ?? t.highway ?? t.railway,
      openingHours: t.opening_hours,
      d: haversine([lon, lat], [c.lon, c.lat]),
    })
  }
  return out.sort((a, b) => a.d - b.d).slice(0, 60).map(({ d, ...p }) => p)
})

/** English special phrases understood by Nominatim, used when Overpass is unavailable. */
const PHRASES: Record<NearbyCategory, string> = {
  restaurant: 'restaurant', cafe: 'cafe', hotel: 'hotel', attraction: 'attraction', transit: 'bus stop',
  parking: 'parking', fuel: 'fuel', pharmacy: 'pharmacy', atm: 'atm', hospital: 'hospital',
}

async function fromNominatim(cat: NearbyCategory, lat: number, lon: number, radius: number): Promise<NearbyPlace[]> {
  const dLat = radius / 111_320, dLon = radius / (111_320 * Math.cos((lat * Math.PI) / 180))
  const qs = new URLSearchParams({
    q: PHRASES[cat], format: 'jsonv2', limit: '40', bounded: '1', extratags: '1',
    viewbox: `${lon - dLon},${lat + dLat},${lon + dLon},${lat - dLat}`,
  })
  const hits = await cached(`nnear:${qs}`, 3600_000, () =>
    $fetch<{ osm_type: string; osm_id: number; lat: string; lon: string; name?: string; type: string; extratags?: Record<string, string> | null }[]>(
      `${useRuntimeConfig().nominatimUrl}/search?${qs}`, { headers: nominatimHeaders, retry: 1, timeout: 10000 }),
  )
  return hits
    .filter((h) => h.name)
    .map((h) => ({
      id: `${h.osm_type}/${h.osm_id}`, name: h.name!, lat: +h.lat, lon: +h.lon, category: cat,
      kind: h.extratags?.cuisine ?? h.type, openingHours: h.extratags?.opening_hours,
      d: haversine([lon, lat], [+h.lon, +h.lat]),
    }))
    .sort((a, b) => a.d - b.d)
    .map(({ d, ...p }) => p)
}
