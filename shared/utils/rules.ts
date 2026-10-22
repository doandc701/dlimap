/**
 * Khoảng cách an toàn tối thiểu giữa hai xe theo Thông tư 38/2024/TT-BGTVT (Điều 11),
 * khi mặt đường khô ráo, tầm nhìn tốt: 60 km/h → 35 m; ≤ 80 → 55 m; ≤ 100 → 70 m; ≤ 120 → 100 m.
 * Dưới 60 km/h, quy định chỉ yêu cầu "chủ động giữ khoảng cách an toàn phù hợp"; ta dùng
 * quy tắc ~2 giây làm gợi ý. Trời mưa, sương mù, đường trơn phải giữ xa hơn.
 */
export function safeDistance(kmh: number): number {
  if (kmh <= 60) return Math.max(10, Math.round((kmh / 3.6) * 2 / 5) * 5)
  if (kmh <= 80) return 55
  if (kmh <= 100) return 70
  return 100
}

/**
 * Parse an OSM maxspeed value. Returns km/h or undefined.
 * Handles "60", "60 mph", "VN:urban" / "VN:rural" / "VN:motorway".
 */
export function parseMaxspeed(v: string | undefined, divided: boolean): number | undefined {
  if (!v) return
  const n = parseFloat(v)
  if (!Number.isNaN(n)) return /mph/.test(v) ? Math.round(n * 1.609) : n
  if (v === 'VN:urban') return divided ? 60 : 50
  if (v === 'VN:rural') return divided ? 90 : 80
  if (v === 'VN:motorway') return 120
}

/**
 * Nhóm phương tiện theo Thông tư 38/2024/TT-BGTVT (Điều 6, 7, 8):
 *  car    – ô tô chở người ≤ 28 chỗ (trừ xe buýt), ô tô tải ≤ 3,5 t
 *  heavy  – ô tô chở người > 28 chỗ (trừ xe buýt), ô tô tải > 3,5 t (trừ xe xi téc)
 *  bus    – xe buýt, ô tô đầu kéo sơ mi rơ moóc, mô tô, ô tô chuyên dùng
 *  tow    – ô tô kéo rơ moóc / kéo xe khác, xe trộn vữa, trộn bê tông, xe xi téc
 *  moped  – xe gắn máy (≤ 50 cm³ / ≤ 50 km/h thiết kế) và xe tương tự: tối đa 40 km/h
 */
export type SpeedClass = 'car' | 'heavy' | 'bus' | 'tow' | 'moped'

/** Ngoài khu đông dân cư: [đường đôi / một chiều ≥ 2 làn, đường hai chiều / một chiều 1 làn] (Điều 7). */
const OUTSIDE: Record<Exclude<SpeedClass, 'moped'>, [number, number]> = {
  car: [90, 80],
  heavy: [80, 70],
  bus: [70, 60],
  tow: [60, 50],
}

/**
 * Giới hạn tốc độ khi đường không có biển báo (dữ liệu OSM không có maxspeed):
 *  - Trong khu đông dân cư (Điều 6, mọi xe cơ giới): 60 km/h đường đôi / một chiều ≥ 2 làn, 50 km/h còn lại.
 *  - Ngoài khu đông dân cư (Điều 7): theo bảng OUTSIDE.
 *  - Xe gắn máy (Điều 8): 40 km/h.
 *  - Cao tốc: theo biển báo, tối đa 120 km/h – khi thiếu dữ liệu ta dùng 100 km/h (thận trọng).
 */
export function ruleMaxspeed(highway: string, residential: boolean, divided: boolean, cls: SpeedClass = 'car'): number {
  if (cls === 'moped') return 40
  if (highway === 'motorway') return Math.min(100, OUTSIDE[cls][0])
  if (highway === 'motorway_link') return 60
  if (highway === 'living_street') return 20
  if (highway === 'service' || highway === 'track') return 30
  if (residential) return divided ? 60 : 50
  return OUTSIDE[cls][divided ? 0 : 1]
}

/**
 * Limit for a vehicle class given an OSM maxspeed (signed for cars) – heavier classes
 * are additionally capped by their own maximum for that kind of road.
 */
export function limitFor(osm: number | undefined, highway: string, residential: boolean, divided: boolean, cls: SpeedClass): number {
  const rule = ruleMaxspeed(highway, residential, divided, cls)
  if (osm == null) return rule
  if (cls === 'car') return osm
  if (cls === 'moped') return Math.min(osm, 40)
  const cap = highway === 'motorway' ? Infinity : residential ? 60 : OUTSIDE[cls][divided ? 0 : 1]
  return Math.min(osm, cap)
}

/** Whether OSM tags describe a divided carriageway (or a multi-lane one-way road). */
export function isDivided(t: Record<string, string>): boolean {
  const lanes = parseInt(t.lanes ?? '0')
  return t.dual_carriageway === 'yes' || (t.oneway === 'yes' && lanes >= 2) || t.highway === 'motorway' || t.highway === 'trunk'
}

export const DRIVABLE_HIGHWAYS = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link'

/** Normalise a road / toll name for keyword matching: lowercase, no dashes or punctuation. */
export function normName(s: string): string {
  return s.toLowerCase().normalize('NFC').replace(/[-–—_.,;:()/\\]+/g, ' ').replace(/\s+/g, ' ').trim()
}
