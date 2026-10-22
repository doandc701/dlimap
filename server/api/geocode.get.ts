interface NominatimPlace { name?: string; display_name: string; lat: string; lon: string }

export default defineEventHandler(async (event) => {
  const { q, lat, lon } = getQuery(event) as Record<string, string | undefined>
  const base = useRuntimeConfig().nominatimUrl

  if (lat && lon) {
    const url = `${base}/reverse?format=jsonv2&lat=${+lat}&lon=${+lon}&zoom=17`
    const r = await cached(`rev:${(+lat).toFixed(4)},${(+lon).toFixed(4)}`, 3600_000, () =>
      $fetch<NominatimPlace>(url, { headers: nominatimHeaders, retry: 2, retryDelay: 400 }),
    )
    return { name: r.name || r.display_name, address: r.display_name, lat: +r.lat, lon: +r.lon }
  }

  if (!q || q.trim().length < 2) return []
  const qs = new URLSearchParams({ q: q.trim(), format: 'jsonv2', countrycodes: 'vn', limit: '7', addressdetails: '0' })
  const list = await cached(`geo:${q.trim().toLowerCase()}`, 3600_000, () =>
    $fetch<NominatimPlace[]>(`${base}/search?${qs}`, { headers: nominatimHeaders, retry: 2, retryDelay: 400 }),
  )
  return list.map((r) => ({
    name: r.name || r.display_name.split(',')[0],
    address: r.display_name,
    lat: +r.lat,
    lon: +r.lon,
  }))
})
