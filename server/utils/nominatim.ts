/**
 * Every call to the public Nominatim goes through here, to follow its usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/): at most 1 request per second,
 * results cached, and no hammering once it refuses us – being blocked is what breaks search.
 *  - requests are queued 1.1 s apart; one that would wait more than a few seconds is dropped
 *  - after a network error / 429 / 5xx the service is left alone for 2 minutes (fail fast)
 */
const GAP = 1100
const MAX_WAIT = 3500
const PAUSE = 2 * 60_000

let nextSlot = 0
let pausedUntil = 0

export class ServiceBusy extends Error {}

export async function nominatim<T>(path: 'search' | 'reverse', params: Record<string, string>, ttlMs = 3600_000): Promise<T> {
  const qs = new URLSearchParams(params)
  return cached<T>(`nominatim:${path}?${qs}`, ttlMs, async (): Promise<T> => {
    const now = Date.now()
    if (now < pausedUntil) throw new ServiceBusy('Nominatim tạm ngừng (vừa bị từ chối)')
    const slot = Math.max(now, nextSlot)
    if (slot - now > MAX_WAIT) throw new ServiceBusy('Nominatim đang bận')
    nextSlot = slot + GAP
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now))
    try {
      // a plain string URL keeps Nitro's typed-route inference out of it (too deep for template URLs)
      const url: string = `${useRuntimeConfig().nominatimUrl}/${path}?${qs}`
      return (await $fetch<unknown, string>(url, { headers: nominatimHeaders, timeout: 8000, retry: 0 })) as T
    } catch (e: any) {
      const status = e?.response?.status
      if (!status || status === 429 || status >= 500) pausedUntil = Date.now() + PAUSE
      throw e
    }
  })
}

/** Same back-off for the public Photon instance (fair use, no hard rate given). */
let photonPausedUntil = 0
export async function photonFetch<T>(url: string, ttlMs = 3600_000): Promise<T> {
  return cached<T>(`photon:${url}`, ttlMs, async (): Promise<T> => {
    if (Date.now() < photonPausedUntil) throw new ServiceBusy('Photon tạm ngừng (vừa bị từ chối)')
    try {
      return (await $fetch<unknown, string>(url, { headers: nominatimHeaders, timeout: 8000, retry: 0 })) as T
    } catch (e: any) {
      const status = e?.response?.status
      if (!status || status === 429 || status >= 500) photonPausedUntil = Date.now() + PAUSE
      throw e
    }
  })
}
