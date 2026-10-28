/** Accent-insensitive single character: "ị" → "i", "Đ" → "d". */
const foldChar = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

/**
 * Split `text` into plain / bold parts, bolding the start of each word that matches a typed word,
 * ignoring diacritics – "3 dich vong" bolds "3", "Dịch", "Vọng" in "3 Phố Dịch Vọng Hậu".
 */
export function highlight(text: string, query: string): { t: string; b: boolean }[] {
  // a word typed with tone marks only matches the same marks ("bài" doesn't bold "Bãi"); without, any
  const typed = query.toLowerCase().normalize('NFC').split(/[\s,]+/).filter(Boolean)
  const words = typed.map((w) => ({ w: [...w].map(foldChar).join(''), raw: w }))
  const out: { t: string; b: boolean }[] = []
  const push = (t: string, b: boolean) => {
    if (!t) return
    const last = out[out.length - 1]
    if (last && last.b === b) last.t += t
    else out.push({ t, b })
  }
  for (const token of text.split(/(\s+|[,/()-])/)) {
    const folded = [...token].map(foldChar).join('')
    const lower = token.toLowerCase().normalize('NFC')
    // numbers only match whole ("3" is not the start of "34"), words also by their beginning
    const w = words
      .filter(({ w, raw }) => (/^\d/.test(w) ? folded === w : folded.startsWith(w) && (raw === w || lower.startsWith(raw))))
      .sort((a, b) => b.w.length - a.w.length)[0]
    if (!w) { push(token, false); continue }
    const chars = [...token]
    push(chars.slice(0, w.w.length).join(''), true)
    push(chars.slice(w.w.length).join(''), false)
  }
  return out
}
