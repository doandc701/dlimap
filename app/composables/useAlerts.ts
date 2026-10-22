import type { LngLat } from '#shared/types'

export interface Alert {
  id: string
  icon: IconName
  title: string
  detail?: string
  level: 'info' | 'warn' | 'danger'
  distance?: number
}

interface Candidate {
  id: string
  kind: string
  lat: number
  lon: number
  along?: number
  name?: string
  maxspeed?: number
  line?: LngLat[]
}

const REPORT_META: Record<string, { icon: IconName; title: string }> = {
  camera: { icon: 'reportCamera', title: 'Camera (cộng đồng báo)' },
  police: { icon: 'police', title: 'CSGT phía trước' },
  accident: { icon: 'accident', title: 'Tai nạn phía trước' },
  jam: { icon: 'jam', title: 'Kẹt xe phía trước' },
  hazard: { icon: 'hazard', title: 'Nguy hiểm phía trước' },
}

function createAlerts() {
  const { pos } = usePosition()
  const { nav } = useNavigation()
  const { road, nearby, reports } = useRoad()
  const settings = useSettings()
  const { say } = useVoice()
  const clock = useClock()

  let wasResidential = false
  let lastBand = 0

  const motorized = computed(() => isMotorized(settings.value.travelMode))
  const limit = computed(() => (motorized.value ? road.value?.maxspeed ?? null : null))
  const overspeed = computed(() => limit.value != null && pos.value.speed > limit.value + settings.value.tolerance)
  const safeDist = computed(() => safeDistance(pos.value.speed))

  /** Distance ahead (m) to a point, or null when it is behind / off to the side. */
  function ahead(c: Candidate, maxDist: number): number | null {
    const p = pos.value.lngLat
    if (!p) return null
    const prog = nav.value.progress
    if (nav.value.active && prog && !prog.offRoute && c.along != null) {
      const d = c.along - prog.along
      return d > -15 && d <= maxDist ? Math.max(0, d) : null
    }
    // Without an active route, "ahead" relies on the heading, which only means something
    // while moving (a parked car or a desktop browser would otherwise get every nearby point).
    if (pos.value.speed < 5) return null
    const h = pos.value.heading
    if (c.line && c.line.length > 1) {
      // tunnel / no-overtaking stretch: it must lie ahead AND run in our direction,
      // so an underpass crossing beneath the road doesn't count
      let best: { dist: number; point: LngLat; seg: number } | null = null
      for (let i = 0; i < c.line.length - 1; i++) {
        const r = projectOnSegment(p, c.line[i]!, c.line[i + 1]!)
        if (!best || r.dist < best.dist) best = { dist: r.dist, point: r.point, seg: i }
      }
      if (!best || best.dist > maxDist) return null
      const b = bearing(c.line[best.seg]!, c.line[best.seg + 1]!)
      if (Math.min(angleDiff(h, b), angleDiff(h, (b + 180) % 360)) > 30) return null
      if (best.dist < 25) return 0
      return angleDiff(bearing(p, best.point), h) < 35 ? best.dist : null
    }
    const target: LngLat = [c.lon, c.lat]
    const d = haversine(p, target)
    if (d > maxDist) return null
    if (d < 25) return 0
    return angleDiff(bearing(p, target), h) < 35 ? d : null
  }

  const candidates = computed<Candidate[]>(() => {
    const base: Candidate[] = nav.value.routes.length ? nav.value.pois : nearby.value
    const reps: Candidate[] = reports.value.map((r) => ({ id: `rep/${r.id}`, kind: `report:${r.type}`, lat: r.lat, lon: r.lon, name: r.note }))
    return [...base, ...reps]
  })

  const alerts = computed<Alert[]>(() => {
    void clock.value
    const out: Alert[] = []
    if (!pos.value.lngLat || !motorized.value) return out

    if (overspeed.value) {
      out.push({ id: 'overspeed', icon: 'overspeed', level: 'danger', title: `Vượt tốc độ! Tối đa ${limit.value} km/h`, detail: `Bạn đang chạy ${Math.round(pos.value.speed)} km/h` })
    }

    for (const c of candidates.value) {
      switch (c.kind) {
        case 'speed_camera':
        case 'red_light_camera': {
          const d = ahead(c, 800)
          if (d == null) break
          const isRed = c.kind === 'red_light_camera'
          out.push({
            id: c.id, icon: 'speedCamera', level: 'warn', distance: d,
            title: isRed ? 'Camera phạt vượt đèn đỏ' : 'Camera phạt nguội tốc độ',
            detail: c.maxspeed ? `Tốc độ tối đa ${c.maxspeed} km/h` : limit.value ? `Tốc độ tối đa ${limit.value} km/h` : undefined,
          })
          break
        }
        case 'traffic_signals': {
          if (!settings.value.showSignals) break
          const d = ahead(c, 250)
          if (d == null) break
          out.push({ id: c.id, icon: 'signals', level: 'info', distance: d, title: 'Đèn giao thông phía trước' })
          break
        }
        case 'no_overtaking': {
          const d = ahead(c, 400)
          if (d == null) break
          out.push({ id: c.id, icon: 'noOvertaking', level: 'warn', distance: d, title: 'Đoạn đường cấm vượt' })
          break
        }
        case 'tunnel': {
          const d = ahead(c, 500)
          if (d == null) break
          out.push({ id: c.id, icon: 'tunnel', level: 'info', distance: d, title: `Hầm chui${c.name ? ' ' + c.name : ''}`, detail: 'Bật đèn chiếu gần, không dừng đỗ, không quay đầu' })
          break
        }
        default:
          if (c.kind.startsWith('report:')) {
            const d = ahead(c, 600)
            if (d == null) break
            const m = REPORT_META[c.kind.slice(7)]!
            out.push({ id: c.id, icon: m.icon, level: 'warn', distance: d, title: m.title, detail: c.name || undefined })
          }
      }
    }

    if (road.value?.noOvertaking && !out.some((a) => a.icon === 'noOvertaking')) {
      out.push({ id: 'road-noovertake', icon: 'noOvertaking', level: 'warn', title: 'Đang trong đoạn cấm vượt' })
    }

    for (const t of nav.value.tolls) {
      const d = ahead({ ...t, kind: 'toll' }, 1500)
      if (d == null) continue
      out.push({ id: t.id, icon: 'toll', level: 'info', distance: d, title: t.name, detail: t.price != null ? `Phí ~${formatVnd(t.price)}${t.kind === 'closed' ? ` (${t.km!.toFixed(0)} km)` : ''}` : 'Chưa có dữ liệu giá' })
      break
    }

    return out
      .filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i)
      .sort((a, b) => (a.level === 'danger' ? -1 : 0) - (b.level === 'danger' ? -1 : 0) || (a.distance ?? 0) - (b.distance ?? 0))
      // one alert per kind of road feature – the nearest traffic light / tunnel / no-overtaking stretch
      .filter((a, i, arr) => !(['signals', 'tunnel', 'noOvertaking'] as IconName[]).includes(a.icon) || arr.findIndex((b) => b.icon === a.icon) === i)
      .slice(0, 4)
  })

  // ---------- voice prompts & side-effects ----------
  watch(alerts, (list) => {
    for (const a of list) {
      if (a.id === 'overspeed') say(`Bạn đã vượt quá tốc độ cho phép ${limit.value} ki lô mét trên giờ`, 'overspeed', 15_000)
      else if (a.icon === 'speedCamera' && a.distance != null && a.distance <= 500) say(`Phía trước ${Math.round(a.distance / 50) * 50} mét có ${a.title.toLowerCase()}. ${a.detail ?? ''}`, a.id, 600_000)
      else if (a.icon === 'noOvertaking' && a.distance != null) say('Phía trước đoạn đường cấm vượt', a.id, 600_000)
      else if (a.icon === 'tunnel' && a.distance != null && a.distance < 300) say('Sắp vào hầm chui, bật đèn chiếu gần', a.id, 600_000)
      else if (a.icon === 'toll' && a.distance != null && a.distance < 800) say(`Sắp đến ${a.title}, ${a.detail}`, a.id, 600_000)
      else if (a.level === 'warn' && a.id.startsWith('rep/') && a.distance != null) say(a.title, a.id, 600_000)
    }
  })

  watch(() => road.value?.residential, (r) => {
    if (r == null || !road.value || !motorized.value) return
    if (r && !wasResidential) say(`Bắt đầu khu đông dân cư, tốc độ tối đa ${road.value.maxspeed} ki lô mét trên giờ`, 'res-in', 120_000)
    if (!r && wasResidential) say('Hết khu đông dân cư', 'res-out', 120_000)
    wasResidential = r
  })

  watch(() => road.value?.maxspeed, (v, old) => {
    if (v && old && v !== old && motorized.value) say(`Tốc độ tối đa ${v} ki lô mét trên giờ`, `limit-${v}`, 60_000)
  })

  // safe-distance reminders when entering a higher speed band
  watch(() => pos.value.speed, (s) => {
    const band = s > 100 ? 4 : s > 80 ? 3 : s > 60 ? 2 : 1
    if (motorized.value && band > lastBand && band >= 2) say(`Giữ khoảng cách an toàn tối thiểu ${safeDistance(s)} mét`, `safe-${band}`, 120_000)
    lastBand = band
  })


  return { alerts, limit, overspeed, safeDist }
}

let instance: ReturnType<typeof createAlerts> | undefined
export function useAlerts() {
  return (instance ??= effectScope(true).run(createAlerts)!)
}
