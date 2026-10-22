interface QueueItem {
  text: string
  at: number
  ttlMs: number
  channel: string
}

const recent = new Map<string, number>()
const queue: QueueItem[] = []
/** text → object URL of pre-downloaded server TTS audio */
const audioCache = new Map<string, Promise<string | null>>()
let playing = false
let current: { audio: HTMLAudioElement; channel: string; stop: () => void } | null = null
let viVoice: SpeechSynthesisVoice | null | undefined

function findViVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('vi')) ?? null
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  viVoice = findViVoice()
  // voices load asynchronously in Chrome
  speechSynthesis.addEventListener?.('voiceschanged', () => (viVoice = findViVoice()))
}

/** Split into chunks ≤ 190 chars (server TTS limit), on sentence / comma boundaries. */
function chunks(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/(?<=[.!?,;])\s+/)) {
    const last = out[out.length - 1]
    if (last && last.length + part.length < 190) out[out.length - 1] = `${last} ${part}`
    else out.push(part.slice(0, 190))
  }
  return out.filter(Boolean)
}

function loadAudio(text: string): Promise<string | null> {
  let p = audioCache.get(text)
  if (!p) {
    p = fetch(`/api/tts?q=${encodeURIComponent(text)}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null)
    audioCache.set(text, p)
    p.then((u) => { if (!u) audioCache.delete(text) })
    if (audioCache.size > 120) {
      const [oldText, oldUrl] = audioCache.entries().next().value!
      audioCache.delete(oldText)
      oldUrl.then((u) => u && URL.revokeObjectURL(u))
    }
  }
  return p
}

async function playNext() {
  if (playing) return
  let item: QueueItem | undefined
  // drop prompts that went stale while waiting (the vehicle has moved on)
  while ((item = queue.shift()) && Date.now() - item.at > item.ttlMs) {}
  if (!item) return
  playing = true
  try {
    const url = await loadAudio(item.text)
    if (url && Date.now() - item.at <= item.ttlMs + 1500) {
      const audio = new Audio(url)
      await new Promise<void>((resolve) => {
        current = { audio, channel: item!.channel, stop: () => { audio.pause(); resolve() } }
        audio.onended = audio.onerror = () => resolve()
        audio.play().catch(() => resolve())
      })
      current = null
    }
  } finally {
    playing = false
    playNext()
  }
}

export interface SayOptions {
  /** drop the prompt if it can't start within this time (default 10 s) */
  ttlMs?: number
  /** a new prompt replaces queued prompts of the same channel (e.g. 'nav') */
  channel?: string
}

/**
 * Vietnamese voice prompts with de-duplication by key. Uses the browser's vi-VN
 * voice when available, otherwise falls back to the server TTS (/api/tts),
 * with audio pre-downloaded via `prefetch` so prompts play without delay.
 */
export function useVoice() {
  const settings = useSettings()

  function engine(): 'browser' | 'server' {
    if (settings.value.voiceEngine === 'browser') return 'browser'
    if (settings.value.voiceEngine === 'server') return 'server'
    return viVoice ? 'browser' : 'server'
  }

  function say(text: string, key = text, cooldownMs = 30_000, opts: SayOptions = {}) {
    if (!settings.value.voice) return
    const last = recent.get(key)
    if (last && Date.now() - last < cooldownMs) return
    recent.set(key, Date.now())
    const { ttlMs = 10_000, channel = 'alert' } = opts

    if (engine() === 'browser' && 'speechSynthesis' in window) {
      // speechSynthesis has no per-item cancel; a new nav prompt flushes everything pending
      if (channel === 'nav' && speechSynthesis.pending) speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'vi-VN'
      u.rate = 1.05
      if (viVoice) u.voice = viVoice
      speechSynthesis.speak(u)
      return
    }

    if (channel === 'nav') {
      // a newer turn instruction supersedes older ones, even mid-sentence
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i]!.channel === 'nav') queue.splice(i, 1)
      if (current?.channel === 'nav') current.stop()
    }
    const now = Date.now()
    for (const c of chunks(text)) {
      queue.push({ text: c, at: now, ttlMs, channel })
      loadAudio(c)
    }
    playNext()
  }

  /** Download audio for prompts that will be needed soon (server engine only). */
  function prefetch(texts: string[]) {
    if (!settings.value.voice || engine() !== 'server') return
    for (const t of texts) for (const c of chunks(t)) loadAudio(c)
  }

  return { say, prefetch, engine, hasBrowserVoice: () => !!viVoice }
}
