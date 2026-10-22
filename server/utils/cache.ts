const store = new Map<string, { at: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

/** Tiny in-memory TTL cache with request de-duplication. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T
  const running = inflight.get(key)
  if (running) return running as Promise<T>
  const p = fn()
    .then((value) => {
      store.set(key, { at: Date.now(), value })
      if (store.size > 5000) store.delete(store.keys().next().value!)
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
