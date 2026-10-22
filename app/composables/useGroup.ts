import type { GroupMember } from '#shared/types'

/** "Đi theo nhóm": share positions with friends via a short room code. */
function createGroup() {
  const { pos } = usePosition()
  const settings = useSettings()
  const self = usePersisted('groupSelf', () => ({ id: crypto.randomUUID(), code: '' }))
  const members = useState<GroupMember[]>('groupMembers', () => [])
  const error = ref('')
  let timer: ReturnType<typeof setInterval> | null = null

  const others = computed(() => members.value.filter((m) => m.id !== self.value.id))

  async function sync() {
    const code = self.value.code
    if (!code) return
    try {
      const p = pos.value.lngLat
      members.value = p
        ? await $fetch<GroupMember[]>(`/api/group/${code}`, {
            method: 'POST',
            body: {
              id: self.value.id, name: settings.value.nickname, color: settings.value.color,
              lat: p[1], lon: p[0], speed: Math.round(pos.value.speed), heading: Math.round(pos.value.heading),
            },
          })
        : await $fetch<GroupMember[]>(`/api/group/${code}`)
      error.value = ''
    } catch (e: any) {
      error.value = e?.data?.statusMessage ?? 'Không đồng bộ được nhóm'
    }
  }

  function join(code: string) {
    self.value.code = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    if (timer) clearInterval(timer)
    timer = setInterval(sync, 3000)
    return sync()
  }

  function create() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join('')
    return join(code)
  }

  async function leave() {
    const code = self.value.code
    if (timer) clearInterval(timer)
    timer = null
    self.value.code = ''
    members.value = []
    if (code) await $fetch(`/api/group/${code}`, { method: 'POST', body: { id: self.value.id, leave: true } }).catch(() => {})
  }

  if (self.value.code) join(self.value.code)

  return { self, members, others, error, join, create, leave }
}

let instance: ReturnType<typeof createGroup> | undefined
export function useGroup() {
  return (instance ??= effectScope(true).run(createGroup)!)
}
