/** "Không còn nữa" – another driver confirms the situation is over. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { voter } = await readBody<{ voter?: string }>(event)
  if (!voter || typeof voter !== 'string') throw createError({ statusCode: 400 })
  const list = await loadReports()
  const r = list.find((x) => x.id === id)
  if (!r) return { removed: true }
  r.goneVotes = [...new Set([...(r.goneVotes ?? []), voter.slice(0, 40)])]
  const removed = r.goneVotes.length >= GONE_VOTES
  await saveReports(removed ? list.filter((x) => x.id !== id) : list)
  return { removed, votes: r.goneVotes.length }
})
