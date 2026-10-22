export const REPORT_TYPES = ['camera', 'police', 'accident', 'jam', 'hazard'] as const
export type ReportType = (typeof REPORT_TYPES)[number]

/** How long a report stays on the map – traffic situations go stale quickly. */
export const REPORT_TTL: Record<ReportType, number> = {
  jam: 60 * 60_000,
  accident: 2 * 3600_000,
  police: 2 * 3600_000,
  hazard: 12 * 3600_000,
  camera: 30 * 24 * 3600_000,
}

/** "No longer there" votes from other users that remove a report. */
export const GONE_VOTES = 2

export interface StoredReport {
  id: string
  type: ReportType
  lat: number
  lon: number
  note: string
  createdAt: number
  /** secret returned to the author only; lets them delete their own report */
  token?: string
  goneVotes?: string[]
}

export async function loadReports(): Promise<StoredReport[]> {
  const list = (await useStorage('data').getItem<StoredReport[]>('reports')) ?? []
  const now = Date.now()
  return list.filter((r) => now - r.createdAt < (REPORT_TTL[r.type] ?? REPORT_TTL.hazard))
}

export function saveReports(list: StoredReport[]) {
  return useStorage('data').setItem('reports', list.slice(-2000))
}

/** Public view: never expose the author token. */
export function publicReport(r: StoredReport) {
  return {
    id: r.id, type: r.type, lat: r.lat, lon: r.lon, note: r.note, createdAt: r.createdAt,
    expiresAt: r.createdAt + (REPORT_TTL[r.type] ?? REPORT_TTL.hazard),
    goneVotes: r.goneVotes?.length ?? 0,
    /** created before author tokens existed – anyone may delete it */
    ownerless: !r.token,
  }
}
