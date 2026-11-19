// Page themes. A page stores { preset, ...overrides } in pages.theme.

export const FONTS = {
  dm: { label: 'DM Sans', css: '"DM Sans", "Noto Sans Devanagari", sans-serif' },
  bricolage: { label: 'Bricolage', css: '"Bricolage Grotesque", "Noto Sans Devanagari", sans-serif' },
  poppins: { label: 'Poppins', css: '"Poppins", "Noto Sans Devanagari", sans-serif', google: 'Poppins:wght@400;500;600;700' },
  playfair: { label: 'Playfair', css: '"Playfair Display", "Noto Serif Devanagari", serif', google: 'Playfair+Display:wght@500;600;700' },
  space: { label: 'Space Grotesk', css: '"Space Grotesk", "Noto Sans Devanagari", sans-serif', google: 'Space+Grotesk:wght@400;500;600;700' },
  mukta: { label: 'Mukta (हिंदी)', css: '"Mukta", "Noto Sans Devanagari", sans-serif', google: 'Mukta:wght@400;500;600;700' },
  outfit: { label: 'Outfit', css: '"Outfit", "Noto Sans Devanagari", sans-serif', google: 'Outfit:wght@400;500;600;700' },
  anton: { label: 'Anton (tall)', css: '"Anton", "Noto Sans Devanagari", sans-serif', google: 'Anton' },
  mono: { label: 'Space Mono', css: '"Space Mono", ui-monospace, monospace', google: 'Space+Mono:wght@400;700' },
  pixel: { label: 'Silkscreen (pixel)', css: '"Silkscreen", "Space Grotesk", sans-serif', google: 'Silkscreen:wght@400;700' },
}

export const PRESETS = {
  cream: {
    label: 'Cream',
    bgType: 'solid', bg: '#F2F1EC', bg2: '#F2F1EC',
    text: '#15161A', buttonBg: '#15161A', buttonText: '#FFFFFF',
    buttonStyle: 'fill', radius: 'pill', font: 'dm', headingFont: 'bricolage', accent: '#D5F05C',
  },
  midnight: {
    label: 'Midnight',
    bgType: 'solid', bg: '#15161A', bg2: '#15161A',
    text: '#FFFFFF', buttonBg: '#D5F05C', buttonText: '#15161A',
    buttonStyle: 'fill', radius: 'pill', font: 'dm', headingFont: 'bricolage', accent: '#B9AFF5',
  },
  lilac: {
    label: 'Lilac',
    bgType: 'gradient', bg: '#EFECFE', bg2: '#DFDAFB',
    text: '#15161A', buttonBg: '#FFFFFF', buttonText: '#15161A',
    buttonStyle: 'shadow', radius: 'rounded', font: 'dm', headingFont: 'bricolage', accent: '#B9AFF5',
  },
  lime: {
    label: 'Lime',
    bgType: 'solid', bg: '#D5F05C', bg2: '#D5F05C',
    text: '#15161A', buttonBg: '#15161A', buttonText: '#D5F05C',
    buttonStyle: 'fill', radius: 'pill', font: 'space', headingFont: 'space', accent: '#15161A',
  },
  sunset: {
    label: 'Sunset',
    bgType: 'gradient', bg: '#FFB88C', bg2: '#DE6262',
    text: '#FFFFFF', buttonBg: '#FFFFFF', buttonText: '#7A2E2E',
    buttonStyle: 'soft', radius: 'pill', font: 'poppins', headingFont: 'poppins', accent: '#FFE29A',
  },
  ocean: {
    label: 'Ocean',
    bgType: 'gradient', bg: '#0F6B5F', bg2: '#15161A',
    text: '#FFFFFF', buttonBg: '#FFFFFF', buttonText: '#0F6B5F',
    buttonStyle: 'outline', radius: 'rounded', font: 'outfit', headingFont: 'outfit', accent: '#D5F05C',
  },
  rose: {
    label: 'Rose',
    bgType: 'solid', bg: '#FFF1F2', bg2: '#FFF1F2',
    text: '#4C0519', buttonBg: '#E11D48', buttonText: '#FFFFFF',
    buttonStyle: 'fill', radius: 'rounded', font: 'playfair', headingFont: 'playfair', accent: '#FDA4AF',
  },
  paper: {
    label: 'Paper',
    bgType: 'solid', bg: '#FFFFFF', bg2: '#FFFFFF',
    text: '#15161A', buttonBg: '#15161A', buttonText: '#FFFFFF',
    buttonStyle: 'outline', radius: 'square', font: 'mukta', headingFont: 'mukta', accent: '#D5F05C',
  },
}

export const DEFAULT_THEME = { preset: 'cream', ...PRESETS.cream }

export function resolveTheme(theme) {
  const preset = PRESETS[theme?.preset] || PRESETS.cream
  return { ...preset, ...(theme || {}) }
}

export const RADIUS = { pill: '9999px', rounded: '18px', square: '6px' }

/** Load a Google font on demand (public pages only pull the font they use) */
export function ensureFont(key) {
  const font = FONTS[key]
  if (!font?.google || typeof document === 'undefined') return
  const id = `gf-${key}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
}

/** A subtle texture drawn over the page colour */
export const PATTERNS = { dots: 'Dots', grid: 'Grid', stripes: 'Stripes', glow: 'Glow', blobs: 'Blobs', checker: 'Checker', rays: 'Rays', lines: 'Notebook' }

function patternLayer(t) {
  const c = hexAlpha(t.text, 0.12)
  switch (t.pattern) {
    case 'dots': return `radial-gradient(${hexAlpha(t.text, 0.2)} 1.3px, transparent 1.5px) 0 0 / 22px 22px`
    case 'grid': return `linear-gradient(${c} 1px, transparent 1px) 0 0 / 30px 30px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0 / 30px 30px`
    case 'stripes': return `repeating-linear-gradient(135deg, ${hexAlpha(t.text, 0.07)} 0 2px, transparent 2px 16px)`
    case 'glow': return `radial-gradient(70% 45% at 50% 0%, ${hexAlpha(t.accent || t.buttonBg, 0.38)}, transparent 70%)`
    case 'blobs': return `radial-gradient(40% 30% at 12% 8%, ${hexAlpha(t.accent || t.buttonBg, 0.5)}, transparent 70%), radial-gradient(45% 35% at 95% 55%, ${hexAlpha(t.buttonBg, 0.28)}, transparent 70%), radial-gradient(40% 30% at 10% 95%, ${hexAlpha(t.accent || t.buttonBg, 0.4)}, transparent 70%)`
    case 'checker': return `conic-gradient(${hexAlpha(t.text, 0.07)} 25%, transparent 0 50%, ${hexAlpha(t.text, 0.07)} 0 75%, transparent 0) 0 0 / 56px 56px`
    case 'rays': return `repeating-conic-gradient(from 0deg at 50% 18%, ${hexAlpha(t.text, 0.07)} 0 7deg, transparent 7deg 14deg)`
    case 'lines': return `repeating-linear-gradient(180deg, transparent 0 31px, ${hexAlpha(t.text, 0.14)} 31px 32px)`
    default: return null
  }
}

/** A darker or lighter version of a colour, for gradients that stay readable */
function shade(hex, amount) {
  const h = (hex || '#000000').replace('#', '')
  const n = parseInt((h.length === 3 ? h.split('').map((c) => c + c).join('') : h).slice(0, 6), 16)
  const f = (v) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)))
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

export function backgroundCss(t, preview = false) {
  const pattern = patternLayer(t)
  const lead = pattern ? `${pattern}, ` : ''
  if (t.bgType === 'image' && t.bgImage) {
    return `${lead}linear-gradient(rgba(0,0,0,${t.bgDim ?? 0.25}), rgba(0,0,0,${t.bgDim ?? 0.25})), url("${t.bgImage}") center/cover ${preview ? '' : 'fixed'}`
  }
  if (t.bgType === 'gradient') return `${lead}linear-gradient(160deg, ${t.bg} 0%, ${t.bg2 || t.bg} 100%)`
  return `${lead}${t.bg}`
}

/** Inline style for buttons rendered on a creator page */
export function buttonCss(t) {
  const radius = RADIUS[t.radius] || RADIUS.pill
  const base = { borderRadius: radius, fontFamily: FONTS[t.font]?.css }
  switch (t.buttonStyle) {
    case 'outline':
      return { ...base, background: 'transparent', color: t.text, border: `2px solid ${t.text}` }
    case 'soft':
      return { ...base, background: hexAlpha(t.buttonBg, 0.22), color: t.text, border: `1px solid ${hexAlpha(t.buttonBg, 0.35)}`, backdropFilter: 'blur(8px)' }
    case 'shadow':
      return { ...base, background: t.buttonBg, color: t.buttonText, border: `2px solid ${t.text}`, boxShadow: `4px 4px 0 ${t.text}` }
    case 'glass':
      return { ...base, background: hexAlpha(t.text, 0.1), color: t.text, border: `1px solid ${hexAlpha(t.text, 0.28)}`, backdropFilter: 'blur(14px)', boxShadow: `0 8px 24px ${hexAlpha(t.text, 0.08)}` }
    case 'underline':
      return { ...base, borderRadius: 0, background: 'transparent', color: t.text, border: '0', borderBottom: `2px solid ${hexAlpha(t.text, 0.85)}` }
    case 'gradient':
      return { ...base, background: `linear-gradient(100deg, ${t.buttonBg}, ${shade(t.buttonBg, -0.42)})`, color: t.buttonText, border: '2px solid transparent' }
    default:
      return { ...base, background: t.buttonBg, color: t.buttonText, border: '2px solid transparent' }
  }
}

export function hexAlpha(hex, alpha) {
  const h = (hex || '#000000').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Readable text colour on top of an arbitrary background */
export function isDark(hex) {
  const h = (hex || '#ffffff').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}
