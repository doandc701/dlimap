import type { LngLat, RoadInfo } from '#shared/types'

/** Information about the road the vehicle is on: name, speed limit, residential area… */
export default defineEventHandler(async (event): Promise<RoadInfo | null> => {
  const q = getQuery(event)
  const lat = Number(q.lat), lon = Number(q.lon), heading = q.heading != null ? Number(q.heading) : undefined
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw createError({ statusCode: 400 })

  // ~10 m grid so nearby requests share cache entries
  const key = `road:${lat.toFixed(4)},${lon.toFixed(4)}`
  const els = await cached(key, 24 * 3600_000, () =>
    overpass(`[out:json][timeout:20];
way(around:30,${lat},${lon})[highway~"^(${DRIVABLE_HIGHWAYS})$"];
out tags geom;
is_in(${lat},${lon})->.a;
(
  area.a["landuse"~"^(residential|commercial|retail)$"];
  area.a[boundary=administrative][name~"^Phường"];
  area.a[place~"^(city|town|suburb|quarter)$"];
);
out tags;`),
  )

  const p: LngLat = [lon, lat]
  let best: { d: number; tags: Record<string, string>; bearing: number } | undefined
  for (const e of els) {
    if (e.type !== 'way' || !e.geometry) continue
    const line = e.geometry.map((g) => [g.lon, g.lat] as LngLat)
    for (let i = 0; i < line.length - 1; i++) {
      const r = projectOnSegment(p, line[i]!, line[i + 1]!)
      let d = r.dist
      const b = bearing(line[i]!, line[i + 1]!)
      // Penalise ways whose direction doesn't match the vehicle heading (e.g. a crossing street).
      if (heading != null && Number.isFinite(heading)) {
        const diff = Math.min(angleDiff(heading, b), angleDiff(heading, (b + 180) % 360))
        d += diff > 45 ? 25 : 0
      }
      // minor service roads only win when clearly closer
      if (e.tags?.highway === 'service') d += 10
      if (!best || d < best.d) best = { d, tags: e.tags ?? {}, bearing: b }
    }
  }
  if (!best) return null

  const t = best.tags
  const residential = els.some((e) => e.type === 'area')
  const divided = isDivided(t)
  const osm = parseMaxspeed(t.maxspeed ?? t['maxspeed:forward'], divided)

  return {
    name: t.name,
    ref: t.ref,
    highway: t.highway,
    maxspeed: osm ?? ruleMaxspeed(t.highway ?? '', residential, divided),
    maxspeedSource: osm ? 'osm' : 'rule',
    osmMaxspeed: osm,
    divided,
    residential,
    tunnel: t.tunnel === 'yes',
    noOvertaking: t.overtaking === 'no',
  }
})
