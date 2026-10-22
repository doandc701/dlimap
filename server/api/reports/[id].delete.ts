/** Delete a report – only its author (holding the token returned at creation) may do this. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { token } = getQuery(event) as { token?: string }
  const list = await loadReports()
  const r = list.find((x) => x.id === id)
  if (!r) return { ok: true }
  // reports created before tokens existed have no owner – allow removing them
  if (r.token && r.token !== token) throw createError({ statusCode: 403, statusMessage: 'Bạn chỉ xoá được báo cáo của mình' })
  await saveReports(list.filter((x) => x.id !== id))
  return { ok: true }
})
