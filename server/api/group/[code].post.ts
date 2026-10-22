import type { GroupMember } from '#shared/types'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')!.toUpperCase()
  if (!/^[A-Z0-9]{4,8}$/.test(code)) throw createError({ statusCode: 400, statusMessage: 'Mã nhóm không hợp lệ' })
  const b = await readBody<Partial<GroupMember> & { leave?: boolean }>(event)
  if (!b.id || typeof b.id !== 'string') throw createError({ statusCode: 400 })

  if (b.leave) {
    removeMember(code, b.id)
  } else if (Number.isFinite(b.lat) && Number.isFinite(b.lon)) {
    upsertMember(code, {
      id: b.id.slice(0, 40),
      name: String(b.name ?? 'Thành viên').slice(0, 30),
      color: /^#[0-9a-f]{6}$/i.test(b.color ?? '') ? b.color! : '#0b5fff',
      lat: b.lat!,
      lon: b.lon!,
      speed: Number(b.speed) || 0,
      heading: Number(b.heading) || 0,
      updatedAt: Date.now(),
    })
  }
  return roomMembers(code)
})
