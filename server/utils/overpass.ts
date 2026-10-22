const UA = 'dlimap/1.0 (https://github.com/dlimap)'
const MIRRORS = ['https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']

export interface OsmElement {
  type: 'node' | 'way' | 'area' | 'relation'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
}

/** The server answered, but this particular query failed (too big, timed out inside Overpass). */
class OverpassQueryError extends Error {}

/** Circuit breaker: a server that just failed at the network level is skipped for a while. */
const DOWN_FOR = 3 * 60_000
const downUntil = new Map<string, number>()

/** Run an Overpass QL query, falling back to public mirrors when the main instance is busy. */
export async function overpass(query: string): Promise<OsmElement[]> {
  const now = Date.now()
  const urls = [useRuntimeConfig().overpassUrl, ...MIRRORS].filter((u) => (downUntil.get(u) ?? 0) < now)
  // every server failed recently: answer at once instead of making the user wait for timeouts
  if (!urls.length) throw createError({ statusCode: 503, statusMessage: 'Overpass không phản hồi (đang thử lại sau)' })
  let lastErr: unknown
  for (const url of urls) {
    try {
      const res = await $fetch<{ elements: OsmElement[]; remark?: string }>(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        timeout: 45000,
        retry: 0,
      })
      if (!res || typeof res !== 'object' || !Array.isArray(res.elements)) throw new Error('Phản hồi Overpass không hợp lệ')
      // Overpass reports timeouts / memory errors as HTTP 200 with a "remark" and partial (often empty) data
      if (res.remark && /error|timeout|out of memory/i.test(res.remark)) throw new OverpassQueryError(res.remark)
      return res.elements
    } catch (e) {
      lastErr = e
      // connection resets, timeouts, 429 / 5xx, HTML error pages → the server itself is unavailable;
      // a query-level error (Overpass "remark") says nothing about the server, so don't trip on it
      if (!(e instanceof OverpassQueryError)) downUntil.set(url, Date.now() + DOWN_FOR)
    }
  }
  throw createError({ statusCode: 502, statusMessage: 'Overpass không phản hồi', data: String(lastErr) })
}

export const nominatimHeaders = { 'User-Agent': UA, 'Accept-Language': 'vi' }
