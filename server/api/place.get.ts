import type { PlaceDetails } from '#shared/types'

interface NominatimHit {
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  name?: string
  address?: Record<string, string>
  extratags?: Record<string, string> | null
}

/**
 * Details for a place tapped on the base map, from its OpenStreetMap object:
 * address, opening hours, phone, website, cuisine… plus a photo from Wikimedia
 * Commons (image / wikimedia_commons / wikidata tags) when the community added one.
 * Looked up through Nominatim (fast) with Overpass as a fallback.
 */
export default defineEventHandler(async (event): Promise<PlaceDetails | null> => {
  const q = getQuery(event)
  const lat = Number(q.lat), lon = Number(q.lon)
  const name = String(q.name ?? '').trim().slice(0, 120)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw createError({ statusCode: 400 })

  if (name) {
    try {
      const hit = await fromNominatim(name, lat, lon)
      if (hit) return hit
    } catch {}
  }

  const esc = name.replace(/[\\"]/g, '\\$&').replace(/[.*+?^${}()|[\]]/g, '\\\\$&')
  const query = name
    ? `[out:json][timeout:20];(nwr(around:80,${lat},${lon})["name"~"^${esc}$",i];nwr(around:80,${lat},${lon})["name:vi"~"^${esc}$",i];);out tags center 10;`
    : `[out:json][timeout:20];nwr(around:25,${lat},${lon})[name];out tags center 10;`
  const els = await cached(`place:${query}`, 24 * 3600_000, () => overpass(query))

  let best: { d: number; el: (typeof els)[number] } | undefined
  for (const el of els) {
    const c = el.lat != null ? { lat: el.lat, lon: el.lon! } : (el as any).center
    if (!c) continue
    const d = haversine([lon, lat], [c.lon, c.lat])
    if (!best || d < best.d) best = { d, el }
  }
  if (!best) return null

  const t = best.el.tags ?? {}
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')
  const address = [t['addr:full'] ?? street, t['addr:subdistrict'] ?? t['addr:ward'], t['addr:district'], t['addr:city'] ?? t['addr:province']]
    .filter(Boolean).join(', ') || undefined
  return detailsFrom(`${best.el.type}/${best.el.id}`, t, address)
})

/** Nominatim search for the name around the tapped point, nearest match within 150 m. */
async function fromNominatim(name: string, lat: number, lon: number): Promise<PlaceDetails | null> {
  const base = useRuntimeConfig().nominatimUrl
  const d = 0.004
  const qs = new URLSearchParams({
    q: name, format: 'jsonv2', extratags: '1', addressdetails: '1', limit: '5', bounded: '1',
    viewbox: `${lon - d},${lat + d},${lon + d},${lat - d}`,
  })
  const hits = await cached(`nplace:${qs}`, 24 * 3600_000, () =>
    $fetch<NominatimHit[]>(`${base}/search?${qs}`, { headers: nominatimHeaders, retry: 1, timeout: 10000 }),
  )
  let best: { d: number; h: NominatimHit } | undefined
  for (const h of hits) {
    const dist = haversine([lon, lat], [+h.lon, +h.lat])
    if (dist < 150 && (!best || dist < best.d)) best = { d: dist, h }
  }
  if (!best) return null
  const h = best.h
  const a = h.address ?? {}
  const address = [
    [a.house_number, a.road].filter(Boolean).join(' '),
    a.quarter ?? a.suburb, a.city_district, a.city ?? a.town ?? a.state,
  ].filter(Boolean).join(', ') || undefined
  return detailsFrom(`${h.osm_type}/${h.osm_id}`, { name: h.name ?? name, ...(h.extratags ?? {}) }, address)
}

async function detailsFrom(osm: string, t: Record<string, string>, address: string | undefined): Promise<PlaceDetails> {
  return {
    osm,
    name: t['name:vi'] ?? t.name,
    address,
    openingHours: t.opening_hours,
    phone: t.phone ?? t['contact:phone'] ?? t.mobile ?? t['contact:mobile'],
    website: t.website ?? t['contact:website'] ?? t.url,
    email: t.email ?? t['contact:email'],
    facebook: t['contact:facebook'] ?? t.facebook,
    cuisine: t.cuisine,
    wheelchair: t.wheelchair,
    internet: t.internet_access,
    brand: t.brand,
    operator: t.operator,
    description: t['description:vi'] ?? t.description,
    photo: await photoFor(t),
    wikipedia: t.wikipedia,
  }
}

/** Wikimedia Commons thumbnail for the place, if OSM links to one. */
async function photoFor(t: Record<string, string>): Promise<string | undefined> {
  const commons = (file: string) =>
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/^File:/i, ''))}?width=640`
  if (t.image && /^https:\/\//.test(t.image)) return t.image.replace(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:(.+)$/, (_, f) => commons(decodeURIComponent(f)))
  if (t.wikimedia_commons?.startsWith('File:')) return commons(t.wikimedia_commons)
  if (t.wikidata && /^Q\d+$/.test(t.wikidata)) {
    try {
      const data = await cached(`wd:${t.wikidata}`, 7 * 24 * 3600_000, () =>
        $fetch<any>(`https://www.wikidata.org/wiki/Special:EntityData/${t.wikidata}.json`, { headers: nominatimHeaders, timeout: 8000 }),
      )
      const file = data?.entities?.[t.wikidata]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
      if (typeof file === 'string') return commons(file)
    } catch {}
  }
}
