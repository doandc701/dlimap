/**
 * Vietnamese text-to-speech fallback for browsers without a vi-VN voice
 * (e.g. Chrome on Linux). Uses Google Translate's TTS endpoint, which is
 * unofficial – swap in a commercial engine (FPT.AI, Viettel AI, Google Cloud TTS…)
 * for production use.
 */
export default defineEventHandler(async (event) => {
  const { q } = getQuery(event) as { q?: string }
  const text = (q ?? '').trim().slice(0, 200)
  if (!text) throw createError({ statusCode: 400 })

  const audio = await cached(`tts:${text}`, 7 * 24 * 3600_000, async () => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(text)}`
    const buf = await $fetch<ArrayBuffer>(url, {
      responseType: 'arrayBuffer',
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' },
      retry: 2,
      retryDelay: 300,
      timeout: 10000,
    })
    return new Uint8Array(buf)
  })

  setHeader(event, 'Content-Type', 'audio/mpeg')
  setHeader(event, 'Cache-Control', 'public, max-age=604800')
  return audio
})
