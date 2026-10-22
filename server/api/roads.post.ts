import type { LngLat, RoadRun } from '#shared/types'

/**
 * Road attributes along a slice of a route (≤ ~40 km): for every route segment,
 * the OSM way it runs on. Lets the client show name / speed limit instantly and
 * keep doing so offline, instead of querying Overpass at every position.
 */
export default defineEventHandler(async (event): Promise<RoadRun[]> => {
  const { line } = await readBody<{ line: LngLat[] }>(event)
  if (!Array.isArray(line) || line.length < 2 || line.length > 3000) throw createError({ statusCode: 400 })

  let poly = line
  for (let tol = 8; poly.length > 180 && tol < 2000; tol *= 2) poly = simplify(line, tol)
  const around = poly.map(([x, y]) => `${y.toFixed(5)},${x.toFixed(5)}`).join(',')
  const q = `[out:json][timeout:50];way(around:15,${around})[highway~"^(${DRIVABLE_HIGHWAYS})$"];out tags geom qt;`
  const ways = (await cached(`roads:${q}`, 24 * 3600_000, () => overpass(q))).filter((w) => w.geometry)

  const segs = ways.map((w) => ({ tags: w.tags ?? {}, line: w.geometry!.map((g) => [g.lon, g.lat] as LngLat) }))
  const runs: RoadRun[] = []

  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!, b = line[i + 1]!
    const mid = lerp(a, b, 0.5)
    const h = bearing(a, b)
    let best: { d: number; tags: Record<string, string> } | undefined
    for (const w of segs) {
      for (let k = 0; k < w.line.length - 1; k++) {
        const r = projectOnSegment(mid, w.line[k]!, w.line[k + 1]!)
        if (r.dist > 20) continue
        const wb = bearing(w.line[k]!, w.line[k + 1]!)
        const diff = Math.min(angleDiff(h, wb), angleDiff(h, (wb + 180) % 360))
        const d = r.dist + (diff > 30 ? 30 : 0)
        if (!best || d < best.d) best = { d, tags: w.tags }
      }
    }
    const t = best?.tags ?? {}
    const divided = isDivided(t)
    const run: RoadRun = {
      from: i, to: i + 1,
      name: t.name, ref: t.ref, highway: t.highway ?? 'unclassified',
      maxspeed: parseMaxspeed(t.maxspeed ?? t['maxspeed:forward'], divided),
      divided, tunnel: t.tunnel === 'yes', noOvertaking: t.overtaking === 'no',
    }
    const prev = runs[runs.length - 1]
    if (prev && prev.name === run.name && prev.highway === run.highway && prev.maxspeed === run.maxspeed
      && prev.tunnel === run.tunnel && prev.noOvertaking === run.noOvertaking && prev.divided === run.divided) {
      prev.to = i + 1
    } else {
      runs.push(run)
    }
  }
  return runs
})
