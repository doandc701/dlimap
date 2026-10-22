import { CLOSED_EXPRESSWAYS } from '../data/tolls'

/** Per-km tariffs of closed-system expressways (small, cached by the client for offline use). */
export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return CLOSED_EXPRESSWAYS
})
