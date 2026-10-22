import type { LngLat, Poi, PoiKind, TollStation } from '#shared/types'
import { matchOpenStation } from '../data/tolls'

/**
 * Hazards and points of interest along a polyline (route) or around a point
 * (free driving): speed cameras, red-light cameras, traffic signals, toll booths,
 * tunnels and no-overtaking stretches, from OpenStreetMap.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ line?: LngLat[]; center?: LngLat; radius?: number }>(event)

  let chunks: string[]
  if (body.line?.length) {
    // Overpass limits query size: simplify, then split into chunks of ~100 vertices.
    let line = body.line
    for (let tol = 20; line.length > 600 && tol < 5000; tol *= 2) line = simplify(body.line, tol)
    chunks = []
    for (let i = 0; i < line.length - 1; i += 100) {
      chunks.push(line.slice(i, i + 101).map(([x, y]) => `${y.toFixed(5)},${x.toFixed(5)}`).join(','))
    }
  } else if (body.center) {
    const r = Math.min(5000, body.radius ?? 2000)
    chunks = [`${body.center[1].toFixed(4)},${body.center[0].toFixed(4)}`]
    return collect(chunks, r, r)
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Cần line hoặc center' })
  }
  return collect(chunks, 60, 25)
})

async function collect(chunks: string[], nodeR: number, wayR: number) {
  const pois = new Map<string, Poi>()
  const tolls = new Map<string, TollStation>()

  for (const c of chunks) {
    const a = `around:${nodeR},${c}`
    const w = `around:${wayR},${c}`
    const q = `[out:json][timeout:50];
(
  node(${a})[highway=speed_camera];
  node(${a})["enforcement"];
  node(${a})[highway=traffic_signals];
  node(${a})[barrier=toll_booth];
  way(${a})[barrier=toll_booth];
  node(${a})[man_made=surveillance]["surveillance:zone"=traffic];
  way(${w})[highway][tunnel=yes];
  way(${w})[highway][overtaking=no];
);
out tags geom qt;`
    const els = await cached(`pois:${q}`, 6 * 3600_000, () => overpass(q))

    for (const e of els) {
      const t = e.tags ?? {}
      const geom = e.geometry?.map((g) => [g.lon, g.lat] as LngLat)
      const lat = e.lat ?? e.geometry?.[0]?.lat
      const lon = e.lon ?? e.geometry?.[0]?.lon
      if (lat == null || lon == null) continue
      const id = `${e.type}/${e.id}`

      if (t.barrier === 'toll_booth') {
        const center = geom ? geom[Math.floor(geom.length / 2)]! : ([lon, lat] as LngLat)
        const hit = matchOpenStation(t.name ?? t.operator)
        if (hit?.stopped) continue
        tolls.set(id, {
          id,
          name: t.name ?? hit?.station.name ?? 'Trạm thu phí',
          lat: center[1],
          lon: center[0],
          operator: t.operator,
          prices: hit?.station.prices ?? null,
          source: hit?.station.source,
        })
        continue
      }

      let kind: PoiKind | undefined
      if (t.highway === 'speed_camera' || t.enforcement === 'maxspeed') kind = 'speed_camera'
      else if (t.enforcement === 'traffic_signals') kind = 'red_light_camera'
      else if (t.highway === 'traffic_signals') kind = 'traffic_signals'
      else if (t.man_made === 'surveillance') kind = 'surveillance'
      else if (t.tunnel === 'yes') kind = 'tunnel'
      else if (t.overtaking === 'no') kind = 'no_overtaking'
      if (!kind) continue

      pois.set(id, {
        id,
        kind,
        lat,
        lon,
        name: t.name,
        maxspeed: t.maxspeed ? parseFloat(t.maxspeed) || undefined : undefined,
        line: kind === 'tunnel' || kind === 'no_overtaking' ? geom : undefined,
      })
    }
  }

  return { pois: [...pois.values()], tolls: [...tolls.values()] }
}
