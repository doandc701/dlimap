import OpeningHours from 'opening_hours'

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const hm = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export interface HoursStatus {
  open: boolean
  /** "Đang mở cửa · Đóng cửa vào 22:00" */
  text: string
  /** one line per day for the next 7 days: ["T2", "08:00–22:00"] */
  week: [string, string][]
}

function parse(value: string, lat: number, lon: number): OpeningHours | null {
  try {
    return new OpeningHours(value, { lat, lon, address: { country_code: 'vn', state: '' } } as any, { mode: 0 } as any)
  } catch {
    return null
  }
}

/** Google-Maps-like summary of an OSM opening_hours value; null when it can't be parsed. */
export function hoursStatus(value: string, lat: number, lon: number, now = new Date()): HoursStatus | null {
  if (value.trim() === '24/7') return { open: true, text: 'Mở cửa 24 giờ', week: [] }
  const oh = parse(value, lat, lon)
  if (!oh) return null

  const open = oh.getState(now)
  const next = oh.getNextChange(now, new Date(now.getTime() + 8 * 86400_000))
  let text: string
  if (open) text = next ? `Đang mở cửa · Đóng cửa vào ${hm(next)}` : 'Đang mở cửa'
  else if (!next) text = 'Đã đóng cửa'
  else {
    const sameDay = next.toDateString() === now.toDateString()
    text = `Đã đóng cửa · Mở cửa lúc ${hm(next)}${sameDay ? '' : ` ${DAYS[next.getDay()]}`}`
  }

  const week: [string, string][] = []
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const from = new Date(start.getTime() + i * 86400_000)
    const to = new Date(from.getTime() + 86400_000)
    const spans = oh.getOpenIntervals(from, to).filter(([, , unknown]) => !unknown)
    const label = spans.length
      ? spans.map(([a, b]) => (b.getTime() - a.getTime() >= 86400_000 - 60_000 ? 'Mở cả ngày' : `${hm(a)}–${b.getTime() === to.getTime() ? '24:00' : hm(b)}`)).join(', ')
      : 'Đóng cửa'
    week.push([DAYS[from.getDay()]!, label])
  }
  return { open, text, week }
}
