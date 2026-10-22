import type { LngLat } from '../types'

const R = 6371008.8
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Great-circle distance in metres. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing a→b in degrees [0, 360). */
export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]))
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]))
  return (deg(Math.atan2(y, x)) + 360) % 360
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Interpolate between two points (fraction t in 0..1). */
export function lerp(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Project p onto segment ab using a local equirectangular approximation. */
export function projectOnSegment(p: LngLat, a: LngLat, b: LngLat): { point: LngLat; t: number; dist: number } {
  const k = Math.cos(rad(p[1]))
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1]
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const point = lerp(a, b, t)
  return { point, t, dist: haversine(p, point) }
}

/** Cumulative distance (m) at every vertex of a line. */
export function cumulative(line: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < line.length; i++) out.push(out[i - 1]! + haversine(line[i - 1]!, line[i]!))
  return out
}

export interface Snap {
  index: number
  point: LngLat
  dist: number
  /** distance along the line from its start (m) */
  along: number
}

/**
 * Snap p to the nearest point of a line. `from`/`window` restrict the search
 * so a vehicle progressing along a route doesn't jump to a parallel leg.
 */
export function snapToLine(p: LngLat, line: LngLat[], cum: number[], from = 0, window = line.length): Snap {
  let best: Snap = { index: 0, point: line[0]!, dist: Infinity, along: 0 }
  const end = Math.min(line.length - 1, from + window)
  for (let i = Math.max(0, from); i < end; i++) {
    const r = projectOnSegment(p, line[i]!, line[i + 1]!)
    if (r.dist < best.dist) {
      best = { index: i, point: r.point, dist: r.dist, along: cum[i]! + haversine(line[i]!, r.point) }
    }
  }
  return best
}

/** Point located `d` metres along a line. */
export function pointAlong(line: LngLat[], cum: number[], d: number): { point: LngLat; index: number } {
  if (d <= 0) return { point: line[0]!, index: 0 }
  const total = cum[cum.length - 1]!
  if (d >= total) return { point: line[line.length - 1]!, index: line.length - 2 }
  let lo = 0, hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! <= d) lo = mid
    else hi = mid
  }
  const seg = cum[hi]! - cum[lo]!
  return { point: lerp(line[lo]!, line[hi]!, seg ? (d - cum[lo]!) / seg : 0), index: lo }
}

/** Douglas–Peucker simplification with tolerance in metres (approx). */
export function simplify(line: LngLat[], tolMeters: number): LngLat[] {
  if (line.length < 3) return line
  const keep = new Uint8Array(line.length)
  keep[0] = keep[line.length - 1] = 1
  const stack: [number, number][] = [[0, line.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let maxD = 0, idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = projectOnSegment(line[i]!, line[s]!, line[e]!).dist
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > tolMeters && idx > 0) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  return line.filter((_, i) => keep[i])
}

export function bbox(line: LngLat[]): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [x, y] of line) {
    if (x < w) w = x
    if (x > e) e = x
    if (y < s) s = y
    if (y > n) n = y
  }
  return [w, s, e, n]
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h} giờ ${m} phút` : `${m} phút`
}

export function formatVnd(v: number): string {
  return v.toLocaleString('vi-VN') + ' đ'
}
