import type { LngLat, SearchResult } from '#shared/types'

interface NominatimPlace { name?: string; display_name: string; lat: string; lon: string }

export default defineEventHandler(async (event) => {
  const { q, lat, lon } = getQuery(event) as Record<string, string | undefined>
  if (lat && lon) {
    // ~10 m grid so nearby taps share the cache (and Nominatim's 1 request/s budget)
    const r = await nominatim<NominatimPlace>('reverse', { format: 'jsonv2', lat: (+lat).toFixed(4), lon: (+lon).toFixed(4), zoom: '17' })
    return { name: r.name || r.display_name, address: r.display_name, lat: +r.lat, lon: +r.lon }
  }

  if (!q || q.trim().length < 2) return []
  return search(q, (getQuery(event).near as string | undefined) ?? '')
})

const PHOTON = 'https://photon.komoot.io/api/'
/** Vietnam, for Photon's bbox filter */
const VN_BBOX = '102.1,8.3,109.6,23.4'

/**
 * Autocomplete like Google Maps, from free OpenStreetMap geocoders:
 *  - Photon: prefix / as-you-type matching, biased to the user's position
 *  - Nominatim: better at "house number + street"
 * Results are merged, de-duplicated and ranked by text match, house number and distance.
 * A typed house number that the map doesn't know is offered on its street ("vị trí gần đúng").
 */
async function search(raw: string, nearParam: string): Promise<SearchResult[]> {
  const query = expandAbbreviations(raw)
  const { number, rest } = splitHouseNumber(query)
  const [nlat, nlon] = nearParam.split(',').map(Number)
  const near: LngLat | null = Number.isFinite(nlat) && Number.isFinite(nlon) ? [nlon!, nlat!] : null

  // biased: what's around the user; un-biased: Photon's own importance ranking finds the
  // well-known places anywhere (an airport, Chợ Bến Thành from Hà Nội) – Google mixes both
  const photon = (text: string, biased = true) => {
    const qs = new URLSearchParams({ q: text, limit: '10', bbox: VN_BBOX })
    if (near && biased) { qs.set('lat', near[1].toFixed(3)); qs.set('lon', near[0].toFixed(3)); qs.set('location_bias_scale', '0.3') }
    return photonFetch<{ features: any[] }>(`${PHOTON}?${qs}`)
      .then((r) => r.features.map(fromPhoton))
      .catch(() => [] as (Candidate | null)[])
  }
  /** Nominatim free-text search, biased (`around`, ~25 km) or limited (`within`, ~2 km) to a point. */
  const nominatimSearch = (text: string, opts: { around?: LngLat | null; within?: LngLat } = {}) => {
    const params: Record<string, string> = { q: text, format: 'jsonv2', countrycodes: 'vn', limit: '8', addressdetails: '1' }
    const box = (p: LngLat, d: number) => `${p[0] - d},${p[1] + d},${p[0] + d},${p[1] - d}`
    if (opts.within) { params.viewbox = box(opts.within, 0.02); params.bounded = '1' }
    else if (opts.around) params.viewbox = box(opts.around, 0.25)
    return nominatim<any[]>('search', params)
      .then((r) => r.map(fromNominatim))
      .catch(() => [] as (Candidate | null)[])
  }

  const famous = (near ? photon(query, false) : Promise.resolve([] as (Candidate | null)[]))
    .then((list) => list.map((c, i) => c && { ...c, prominence: Math.max(0, 2.5 - i * 0.5) }))
  const lists = await Promise.all([photon(query), famous, number ? photon(rest) : Promise.resolve([]), nominatimSearch(query, { around: near })])
  const all = lists.flat().filter((c): c is Candidate => !!c)

  // House number typed and nothing found at that number (typically when Photon is unavailable,
  // Nominatim alone reads "3 dịch vọng hậu" as "a number 3 somewhere in Dịch Vọng Hậu"):
  // find the street by name, then ask for "<number> <full street name>" around it.
  const onStreet = (c: Candidate) => streetMatches(c.street, rest)
  const hasNumber = (c: Candidate) => !!number && !!c.housenumber && fold(c.housenumber) === fold(number) && onStreet(c)
  const add = (list: (Candidate | null)[]) => all.push(...list.filter((c): c is Candidate => !!c))
  if (number && !all.some(hasNumber)) {
    const streets = all.filter((c) => c.kind === 'street' && onStreet(c))
    const best = streets
      .map((c) => { const r = score(c, rest, undefined, near); return { c, s: r.s - r.extra * 1.5 } })
      .sort((a, b) => b.s - a.s)[0]?.c
    if (best) {
      // the street is known: ask for "<number> <full street name>" right there
      add(await nominatimSearch(`${number} ${best.name}`, { within: [best.lon, best.lat] }))
    } else if (!/^(phố|đường|ngõ|ngách|hẻm|kiệt|quốc lộ|đại lộ)\s/i.test(rest)) {
      // typed without the road type ("3 dịch vọng hậu"): Nominatim takes the name for a neighbourhood,
      // but finds the house once told it is a street – Hà Nội names streets "Phố …", most cities "Đường …"
      for (const kind of ['phố', 'đường']) {
        add(await nominatimSearch(`${number} ${kind} ${rest}`, { around: near }))
        if (all.some(hasNumber)) break
      }
    }
  }

  // "3 Phố Dịch Vọng Hậu" as an address row, like Google: exact when something in the data has
  // that number on that street (a shop, a building), else on the best matching street ("gần đúng")
  if (number) {
    const exact = all.find(hasNumber)
    const street = all
      .filter((c) => c.kind === 'street')
      // the street whose name is closest to what was typed: "Đường Trần Duy Hưng", not "Ngõ 154 Đường Trần Duy Hưng"
      .map((c) => { const r = score(c, rest, undefined, near); return { c, s: r.s - r.extra * 1.5 } })
      .sort((a, b) => b.s - a.s)[0]?.c
    const base = exact ?? street
    if (base) {
      const streetName = exact ? exact.street! : street!.name
      all.push({
        name: `${number} ${streetName}`, address: base.kind === 'poi' ? base.address?.split(', ').slice(1).join(', ') : base.address,
        lat: base.lat, lon: base.lon, kind: 'address', category: 'house', approx: !exact,
        street: streetName, housenumber: number, source: 'synth',
      })
    }
  }

  // rank, drop rows matching none of the typed words, merge duplicates (Photon and Nominatim often
  // return the same object; long streets / canals come in many pieces)
  const ranked = all
    .map((c) => ({ c, ...score(c, number ? rest : query, number, near) }))
    .filter((r) => r.matched > 0)
    // a house number was typed: houses / shops with that number on another street are wrong answers
    .filter((r) => !number || !r.c.housenumber || fold(r.c.housenumber) !== fold(number) || onStreet(r.c))
    .sort((a, b) => b.s - a.s)
  // every typed word should match; only when that leaves too little, show partial matches too
  const full = ranked.filter((r) => r.matched === r.words)
  const pool = full.length >= 3 ? full : ranked
  const out: Candidate[] = []
  for (const { c } of pool) {
    if (out.some((o) => sameFeature(o, c))) continue
    out.push(c)
    if (out.length === 8) break
  }
  return out.map(({ source, street, housenumber, ...r }) => r)
}
