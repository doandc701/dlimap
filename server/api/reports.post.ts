export default defineEventHandler(async (event) => {
  const b = await readBody<{ type: string; lat: number; lon: number; note?: string }>(event)
  if (!REPORT_TYPES.includes(b.type as ReportType) || !Number.isFinite(b.lat) || !Number.isFinite(b.lon)) {
    throw createError({ statusCode: 400, statusMessage: 'Báo cáo không hợp lệ' })
  }
  const list = await loadReports()
  const item: StoredReport = {
    id: crypto.randomUUID(),
    type: b.type as ReportType,
    lat: b.lat,
    lon: b.lon,
    note: String(b.note ?? '').slice(0, 140),
    createdAt: Date.now(),
    token: crypto.randomUUID(),
  }
  list.push(item)
  await saveReports(list)
  return { ...publicReport(item), token: item.token }
})
