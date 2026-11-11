// Page themes. A page stores { preset, ...overrides } in pages.theme.

export const FONTS = {
  dm: { label: 'DM Sans', css: '"DM Sans", "Noto Sans Devanagari", sans-serif' },
  bricolage: { label: 'Bricolage', css: '"Bricolage Grotesque", "Noto Sans Devanagari", sans-serif' },
  poppins: { label: 'Poppins', css: '"Poppins", "Noto Sans Devanagari", sans-serif', google: 'Poppins:wght@400;500;600;700' },
  playfair: { label: 'Playfair', css: '"Playfair Display", "Noto Serif Devanagari", serif', google: 'Playfair+Display:wght@500;600;700' },
  space: { label: 'Space Grotesk', css: '"Space Grotesk", "Noto Sans Devanagari", sans-serif', google: 'Space+Grotesk:wght@400;500;600;700' },
  mukta: { label: 'Mukta (हिंदी)', css: '"Mukta", "Noto Sans Devanagari", sans-serif', google: 'Mukta:wght@400;500;600;700' },
  outfit: { label: 'Outfit', css: '"Outfit", "Noto Sans Devanagari", sans-serif', google: 'Outfit:wght@400;500;600;700' },
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

export function backgroundCss(t, preview = false) {
  if (t.bgType === 'image' && t.bgImage) {
    return `linear-gradient(rgba(0,0,0,${t.bgDim ?? 0.25}), rgba(0,0,0,${t.bgDim ?? 0.25})), url("${t.bgImage}") center/cover ${preview ? '' : 'fixed'}`
  }
  if (t.bgType === 'gradient') return `linear-gradient(160deg, ${t.bg} 0%, ${t.bg2 || t.bg} 100%)`
  return t.bg
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
