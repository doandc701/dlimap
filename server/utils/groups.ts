import type { GroupMember } from '#shared/types'

/** In-memory group rooms for "Đi theo nhóm". Members expire after 2 minutes of silence. */
const rooms = new Map<string, Map<string, GroupMember>>()
const TTL = 2 * 60_000

export function roomMembers(code: string): GroupMember[] {
  const room = rooms.get(code)
  if (!room) return []
  const now = Date.now()
  for (const [id, m] of room) if (now - m.updatedAt > TTL) room.delete(id)
  if (!room.size) rooms.delete(code)
  return [...room.values()]
}

export function upsertMember(code: string, m: GroupMember) {
  let room = rooms.get(code)
  if (!room) rooms.set(code, (room = new Map()))
  room.set(m.id, m)
}

export function removeMember(code: string, id: string) {
  rooms.get(code)?.delete(id)
}
