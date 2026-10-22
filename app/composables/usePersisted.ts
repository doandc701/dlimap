const watched = new Set<string>()

/** useState that is mirrored into localStorage. */
export function usePersisted<T>(key: string, init: () => T) {
  const state = useState<T>(key, () => {
    try {
      const raw = localStorage.getItem(`dlimap:${key}`)
      if (raw) return { ...init(), ...JSON.parse(raw) }
    } catch {}
    return init()
  })
  if (!watched.has(key)) {
    watched.add(key)
    watch(state, (v) => {
      try { localStorage.setItem(`dlimap:${key}`, JSON.stringify(v)) } catch {}
    }, { deep: true })
  }
  return state
}
