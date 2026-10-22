import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

type Hsla = [h: number, s: number, l: number, a: number]
type Role = 'area' | 'road' | 'casing' | 'border' | 'text' | 'halo'

function parseColor(v: string): Hsla | null {
  const s = v.trim().toLowerCase()
  let r: number, g: number, b: number, a = 1
  let m = s.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    let hex = m[1]!
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('')
    if (hex.length !== 6 && hex.length !== 8) return null
    r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16)
    if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255
  } else if ((m = s.match(/^hsla?\(([^)]+)\)$/))) {
    const [h, sat, l, al] = m[1]!.split(/[\s,/]+/).map(parseFloat)
    return [h!, sat! / 100, l! / 100, al ?? 1]
  } else if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
    const [rr = 0, gg = 0, bb = 0, aa = 1] = m[1]!.split(/[\s,/]+/).map(parseFloat)
    r = rr; g = gg; b = bb; a = aa
  } else return null
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l, a]
}

const pct = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 1000) / 10}%`

/** Night version of a day-map colour: dark land, dim roads lighter than land, light labels. */
function nightColor([h, s, l, a]: Hsla, role: Role): string {
  // near-grey and beige land colours take the UI's slate hue so map and panels look like one surface
  if (role !== 'road' && (s < 0.15 || (role === 'area' && h >= 20 && h <= 50 && l > 0.85))) { h = 220; s = 0.14 }
  switch (role) {
    case 'area': l = 0.07 + (1 - l) * 0.62; s *= 0.45; break
    case 'road': l = 0.2 + l * 0.14; s *= 0.5; break
    case 'casing': l = 0.11 + l * 0.05; s *= 0.3; break
    case 'border': l = 0.3 + (1 - l) * 0.3; break
    case 'text': l = 0.93 - l * 0.55; s *= 0.8; break
    case 'halo': l = 0.07 + (1 - l) * 0.1; break
  }
  return `hsla(${Math.round(h)},${pct(s)},${pct(l)},${Math.round(a * 100) / 100})`
}

function mapColors(v: unknown, role: Role): unknown {
  if (typeof v === 'string') {
    const c = parseColor(v)
    return c ? nightColor(c, role) : v
  }
  return Array.isArray(v) ? v.map((x) => mapColors(x, role)) : v
}

function roleOf(layer: LayerSpecification, key: string): Role {
  if (key === 'text-color' || key === 'icon-color') return 'text'
  if (key === 'text-halo-color' || key === 'icon-halo-color') return 'halo'
  const src = 'source-layer' in layer ? layer['source-layer'] : undefined
  if (layer.type === 'line' && src === 'transportation') return layer.id.includes('casing') ? 'casing' : 'road'
  if (layer.type === 'line' && src === 'boundary') return 'border'
  return 'area'
}

/** Derive a dark style from a light one, keeping every layer (POIs, 3D buildings, shields…). */
export function darkenStyle(style: StyleSpecification): StyleSpecification {
  const out = structuredClone(style)
  for (const layer of out.layers) {
    const paint = (layer as { paint?: Record<string, unknown> }).paint
    if (layer.type === 'raster') {
      ;(layer as { paint: Record<string, unknown> }).paint = { ...paint, 'raster-brightness-max': 0.3, 'raster-saturation': -0.5 }
      continue
    }
    if (!paint) continue
    // sprite patterns (pedestrian areas, wetland) are drawn for a light map and glare at night
    if (paint['fill-pattern']) paint['fill-opacity'] = 0.15
    for (const key of Object.keys(paint)) if (key.endsWith('-color')) paint[key] = mapColors(paint[key], roleOf(layer, key))
  }
  return out
}

// ---------- Google-Maps-like typography ----------

/** Unicode ranges of the Google Fonts subsets shipped in /public/fonts/roboto (from @fontsource/roboto). */
const SUBSETS: Record<string, string> = {
  'latin': 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  'vietnamese': 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
}

/** Font names usable in `text-font` (Roboto, as on Google Maps), Noto from the glyph server as fallback. */
export const FONT = {
  regular: ['Roboto Regular', 'Noto Sans Regular'],
  medium: ['Roboto Medium', 'Noto Sans Bold'],
  bold: ['Roboto Bold', 'Noto Sans Bold'],
  italic: ['Roboto Italic', 'Noto Sans Italic'],
}

function fontFaces(): StyleSpecification['font-faces'] {
  const faces = (variant: string) => Object.entries(SUBSETS).map(([subset, range]) => ({
    url: `${location.origin}/fonts/roboto/roboto-${subset}-${variant}.woff2`,
    'unicode-range': range.split(','),
  }))
  return {
    'Roboto Regular': faces('400-normal'),
    'Roboto Medium': faces('500-normal'),
    'Roboto Bold': faces('700-normal'),
    'Roboto Italic': faces('400-italic'),
  }
}

/** Google draws road names in a neutral grey with a strong white halo, a touch larger as you zoom in. */
const ROAD_LABEL_SIZE = ['interpolate', ['linear'], ['zoom'], 13, 11, 15, 12.5, 17, 14, 19, 16]

/**
 * Restyle labels like Google Maps: Roboto everywhere (Vietnamese diacritics included) and
 * Google-like road-name colour / size. Layers and their order are left untouched.
 */
export function googleStyle(style: StyleSpecification): StyleSpecification {
  const out = structuredClone(style)
  out['font-faces'] = fontFaces()
  for (const layer of out.layers) {
    if (layer.type !== 'symbol') continue
    const layout = (layer.layout ??= {}) as Record<string, unknown>
    const font = JSON.stringify(layout['text-font'] ?? '')
    layout['text-font'] = font.includes('Bold') ? FONT.medium : font.includes('Italic') ? FONT.italic : FONT.regular
    // the base style never names motorways (expressways, elevated ring roads) – Google does
    if (layer.id === 'highway-name-major') layer.filter = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], true, false]
    if ((layer as { 'source-layer'?: string })['source-layer'] === 'transportation_name' && !layer.id.includes('shield')) {
      layout['text-size'] = ROAD_LABEL_SIZE
      const paint = ((layer as { paint?: Record<string, unknown> }).paint ??= {})
      paint['text-color'] = layer.id.includes('major') ? '#3c4043' : '#5f6368'
      paint['text-halo-color'] = '#ffffff'
      paint['text-halo-width'] = 1.6
      paint['text-halo-blur'] = 0.2
    }
  }
  return out
}

const cache = new Map<string, Promise<StyleSpecification>>()

function cachedStyle(key: string, make: () => Promise<StyleSpecification>): Promise<StyleSpecification> {
  let p = cache.get(key)
  if (!p) {
    p = make()
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

/**
 * Style for the map, with Google-like labels: the light style, or the configured dark
 * style if one is set, otherwise a night version of the light style so both themes
 * show the same detail.
 */
export function resolveMapStyle(dark: boolean, light: string, darkUrl?: string): Promise<StyleSpecification> {
  const base = (url: string) => cachedStyle(url, () => $fetch<StyleSpecification>(url).then(googleStyle))
  if (!dark) return base(light)
  if (darkUrl) return base(darkUrl)
  return cachedStyle(`dark:${light}`, () => base(light).then(darkenStyle))
}
