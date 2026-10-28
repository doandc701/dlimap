import type { LngLat, SearchResult } from '#shared/types'

/** Lowercase, no diacritics, đ → d: "Dịch Vọng" ≈ "dich vong". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
}

/** Vietnamese address abbreviations people type into search boxes. */
const ABBR: [RegExp, string][] = [
  [/(^|\s)p\.\s*/gi, '$1phố '],
  [/(^|\s)(?:đ|d)\.\s*/gi, '$1đường '],
  [/(^|\s)đg\.?\s+/gi, '$1đường '],
  [/(^|\s)ng\.\s*/gi, '$1ngõ '],
  [/(^|\s)ngh\.\s*/gi, '$1ngách '],
  [/(^|\s)q\.\s*/gi, '$1quận '],
  [/(^|\s)tp\.?\s+/gi, '$1thành phố '],
  [/(^|\s)tx\.?\s+/gi, '$1thị xã '],
  [/(^|\s)kđt\s+/gi, '$1khu đô thị '],
  [/(^|\s)kcn\s+/gi, '$1khu công nghiệp '],
  [/(^|\s)bv\s+/gi, '$1bệnh viện '],
  [/(^|\s)đh\s+/gi, '$1đại học '],
  [/(^|\s)ubnd\s+/gi, '$1ủy ban nhân dân '],
]

export function expandAbbreviations(q: string): string {
  let s = ` ${q.trim()} `
  for (const [re, to] of ABBR) s = s.replace(re, to)
  return s.replace(/\s+/g, ' ').trim()
}

/** Words that only say what kind of road it is – "Đường Trần Duy Hưng" is the same street as "Trần Duy Hưng". */
const ROAD_WORDS = new Set(['duong', 'pho', 'ngo', 'ngach', 'hem', 'kiet', 'quoc', 'tinh', 'dai', 'lo', 'phuong'])

/** True when every distinctive typed word (not "phố", "đường"…) is in the street name; the last may be partial. */
export function streetMatches(street: string | undefined, text: string): boolean {
  if (!street) return false
  const have = fold(street).split(/[\s,/()-]+/)
  const want = fold(text).split(/[\s,/()-]+/).filter((w) => w && !ROAD_WORDS.has(w))
  return want.length > 0 && want.every((w, i) => have.some((h) => (i === want.length - 1 ? h.startsWith(w) : h === w)))
}

/** "số 3 dịch vọng hậu", "3A dịch vọng", "12/5 láng" → house number + the rest. */
export function splitHouseNumber(q: string): { number?: string; rest: string } {
  const m = q.match(/^(?:số\s*)?(\d+[a-z]?(?:\/\d+[a-z]?)*)[\s,]+(.{2,})$/i)
  return m ? { number: m[1]!, rest: m[2]! } : { rest: q }
}

const STREET_TYPES = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'motorway', 'residential', 'unclassified', 'living_street', 'service', 'pedestrian', 'road', 'street'])
const AREA_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood', 'district', 'county', 'state', 'administrative', 'locality', 'isolated_dwelling'])

export interface Candidate extends SearchResult {
  /** street name of an address / street result (for house-number synthesis) */
  street?: string
  housenumber?: string
  source: 'photon' | 'nominatim' | 'synth'
  /** rank bonus for well-known places (position in Photon's un-biased, importance-ranked list) */
  prominence?: number
}

const join = (...parts: (string | undefined)[]) => [...new Set(parts.filter((p): p is string => !!p && !!p.trim()))].join(', ')

/** Photon (komoot) GeoJSON feature → candidate. */
export function fromPhoton(f: any): Candidate | null {
  const p = f.properties ?? {}
  const [lon, lat] = f.geometry?.coordinates ?? []
  if (lat == null || lon == null) return null
  const value: string = p.osm_value ?? ''
  const street = p.street as string | undefined
  let kind: Candidate['kind']
  if (p.type === 'house' && !p.name) kind = 'address'
  else if (p.type === 'street' || (p.osm_key === 'highway' && STREET_TYPES.has(value))) kind = 'street'
  else if (AREA_TYPES.has(p.type) || AREA_TYPES.has(value) || p.osm_key === 'place' || p.osm_key === 'boundary') kind = 'area'
  else kind = 'poi'
  const name = p.name ?? (p.housenumber && street ? `${p.housenumber} ${street}` : street)
  if (!name) return null
  const area = join(p.district ?? p.locality, p.city ?? p.county, p.city ? undefined : p.state)
  const addr = kind === 'address' || kind === 'street'
    ? area
    : join(p.housenumber && street ? `${p.housenumber} ${street}` : street, area)
  return {
    name, address: addr || undefined, lat, lon, kind, category: value || undefined,
    street: kind === 'street' ? p.name : street, housenumber: p.housenumber, source: 'photon',
  }
}

/** Nominatim jsonv2 (addressdetails=1) → candidate. */
export function fromNominatim(r: any): Candidate | null {
  const a = r.address ?? {}
  const lat = +r.lat, lon = +r.lon
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const road: string | undefined = a.road ?? a.pedestrian ?? a.footway
  const value: string = r.type ?? ''
  let kind: Candidate['kind']
  if (r.category === 'highway' && STREET_TYPES.has(value)) kind = 'street'
  else if (r.category === 'place' && (value === 'house' || value === 'building') || (!r.name && a.house_number)) kind = 'address'
  else if (r.category === 'boundary' || r.category === 'place' || AREA_TYPES.has(r.addresstype)) kind = 'area'
  else kind = 'poi'
  // a bare house ("3") is named after its address, like Google does
  const name = r.name && !/^\d+[a-z]?$/i.test(r.name) ? r.name : a.house_number && road ? `${a.house_number} ${road}` : r.name || road
  if (!name) return null
  const area = join(a.quarter ?? a.suburb ?? a.neighbourhood, a.city_district, a.city ?? a.town ?? a.county ?? a.state)
  const addr = kind === 'address' || kind === 'street' ? area : join(a.house_number && road ? `${a.house_number} ${road}` : road, area)
  return {
    name, address: addr || undefined, lat, lon, kind, category: value || undefined,
    street: kind === 'street' ? r.name : road, housenumber: a.house_number, source: 'nominatim',
  }
}

/**
 * Relevance of a candidate for the typed text (house number excluded):
 * every typed word (folded) should start a word of the name, or else of the address; the last
 * word may be partial (as-you-type). Numbers must match exactly ("3" is not "34").
 * Returns the score and how many words matched at all.
 */
export function score(c: Candidate, text: string, number: string | undefined, near: LngLat | null): { s: number; matched: number; words: number; extra: number } {
  // "Landmark72" ≈ "landmark 72": letters and digits are separate words. Words are kept with their
  // tone marks too: typed with marks, "bài" should beat "bãi" (typed without, both match equally)
  const tokens = (t: string) => t.toLowerCase().normalize('NFC').replace(/(\p{L})(\d)|(\d)(\p{L}{2,})/gu, '$1$3 $2$4').split(/[\s,/()-]+/).filter(Boolean)
  const typed = tokens(text)
  const words = typed.map(fold)
  const nameRaw = tokens(c.name)
  const nameWords = nameRaw.map(fold)
  const addrRaw = tokens(c.address ?? '')
  const allRaw = [...nameRaw, ...addrRaw]
  const allWords = allRaw.map(fold)
  let s = 0
  let matched = 0
  words.forEach((w, i) => {
    const partial = i === words.length - 1 && !/^\d/.test(w)
    const same = (a: string, b: string) => (partial ? a.startsWith(b) : a === b)
    const exact = typed[i] !== w // the user typed tone marks / đ for this word
    const find = (folded: string[], raw: string[]) => {
      const idx = folded.findIndex((x) => same(x, w))
      if (idx < 0) return 0
      // with marks typed: a word that only matches once marks are dropped counts for less
      return !exact || raw.some((x, j) => same(folded[j]!, w) && same(x, typed[i]!)) ? 1 : 0.35
    }
    const inName = find(nameWords, nameRaw)
    const inAll = inName ? 0 : find(allWords, allRaw)
    // a word matching only once tone marks are dropped ("bài" ~ "bãi") scores a little, but doesn't count as matched
    if (inName) { s += 3 * inName; if (inName === 1) matched++ }
    else if (inAll) { s += 1.5 * inAll; if (inAll === 1) matched++ }
    else s -= 2
  })
  // the whole name is what was typed ("Landmark72", not "Landmark72 Garden")
  // (ignoring the road type: "Đường Trần Duy Hưng" is exactly "trần duy hưng")
  const bare = (list: string[]) => list.filter((w) => !ROAD_WORDS.has(w)).join(' ')
  if (bare(nameWords) === bare(words)) s += 3
  if (number) {
    const sameNumber = !!c.housenumber && fold(c.housenumber) === fold(number)
    const rightStreet = streetMatches(c.street, text)
    if (sameNumber && rightStreet) s += c.kind === 'address' ? 6 : 3
    else if (sameNumber) s -= 3 // that number, but on another street ("3 Tôn Thất Thuyết")
    else if (c.kind === 'address') s -= 3 // a house with another number
  }
  if (c.kind === 'street' || c.kind === 'area') s += 0.5
  // stops named after a landmark ("Sân bay Nội Bài - Tuyến 86") rank below the landmark itself
  if (c.category === 'bus_stop' || c.category === 'platform') s -= 1.5
  s += c.prominence ?? 0
  if (near) {
    const km = haversine(near, [c.lon, c.lat]) / 1000
    s += 3 / (1 + km / 3) // within a few km of the user ranks clearly higher
  }
  return { s, matched, words: words.length, extra: nameWords.filter((n) => !ROAD_WORDS.has(n) && !words.some((w) => n.startsWith(w))).length }
}

/** Long features split into many OSM pieces (streets, canals, rivers) – one row per name nearby. */
export function sameFeature(a: Candidate, b: Candidate): boolean {
  if (fold(a.name) !== fold(b.name)) return false
  const d = haversine([a.lon, a.lat], [b.lon, b.lat])
  const linear = (c: Candidate) => c.kind === 'street' || c.kind === 'area' || ['canal', 'river', 'stream', 'drain', 'ditch'].includes(c.category ?? '')
  return d < 150 || (linear(a) && linear(b) && d < 3000)
}
