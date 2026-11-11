// Generates the PWA / home-screen icons from the brand mark (ink tile + lime link glyph).
// Dependency-free: rasterises signed-distance shapes with analytic anti-aliasing and writes PNGs via zlib.
//   node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const INK = [0x15, 0x16, 0x1a]
const LIME = [0xd5, 0xf0, 0x5c]

// ---------- Glyph geometry (same path as public/favicon.svg, 64-unit space) ----------
// M27 37 l10-10 | M24.5 31.5 l-2 2 a6 6 0 0 0 8.5 8.5 l2-2 | M39.5 32.5 l2-2 a6 6 0 0 0 -8.5-8.5 l-2 2
const STROKE = 4

function arcPoints(p1, p2, steps = 48) {
  // Half circle between p1 and p2, bulging away from the glyph centre (32, 32)
  const c = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
  const r = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2
  const a0 = Math.atan2(p1[1] - c[1], p1[0] - c[0])
  const candidates = [1, -1].map((dir) => {
    const pts = []
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (dir * Math.PI * i) / steps
      pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)])
    }
    return pts
  })
  const mid = (pts) => pts[Math.floor(pts.length / 2)]
  const far = (pts) => Math.hypot(mid(pts)[0] - 32, mid(pts)[1] - 32)
  return far(candidates[0]) > far(candidates[1]) ? candidates[0] : candidates[1]
}

function polylineSegments(points) {
  const segs = []
  for (let i = 1; i < points.length; i++) segs.push([points[i - 1], points[i]])
  return segs
}

const SEGMENTS = [
  ...polylineSegments([[27, 37], [37, 27]]),
  ...polylineSegments([[24.5, 31.5], [22.5, 33.5], ...arcPoints([22.5, 33.5], [31, 42]), [33, 40]]),
  ...polylineSegments([[39.5, 32.5], [41.5, 30.5], ...arcPoints([41.5, 30.5], [33, 22]), [31, 24]]),
]

function distToSegment(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Signed distance (glyph units) to the stroked glyph; negative inside. */
function glyphSdf(x, y) {
  let d = Infinity
  for (const s of SEGMENTS) d = Math.min(d, distToSegment(x, y, s))
  return d - STROKE / 2
}

/** Signed distance to a rounded rectangle centred at (cx, cy). */
function roundRectSdf(x, y, cx, cy, half, radius) {
  const qx = Math.abs(x - cx) - (half - radius)
  const qy = Math.abs(y - cy) - (half - radius)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

const cover = (sdfPx) => Math.max(0, Math.min(1, 0.5 - sdfPx))

/**
 * @param size      output pixels
 * @param corner    tile corner radius as a fraction of size (0 = full-bleed square)
 * @param glyphSpan glyph width (the 24-unit link) as a fraction of size
 */
function render(size, { corner, glyphSpan }) {
  const px = new Uint8Array(size * size * 4)
  const unit = (glyphSpan * size) / 24 // pixels per glyph unit
  const c = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x + 0.5
      const sy = y + 0.5
      const tile = corner > 0 ? cover(roundRectSdf(sx, sy, c, c, c, corner * size)) : 1
      const gx = 32 + (sx - c) / unit
      const gy = 32 + (sy - c) / unit
      const g = cover(glyphSdf(gx, gy) * unit)
      const i = (y * size + x) * 4
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(INK[k] * (1 - g) + LIME[k] * g)
      px[i + 3] = Math.round(255 * tile)
    }
  }
  return encodePng(size, size, px)
}

// ---------- PNG encoder ----------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter: none
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- Output ----------
const ICONS = [
  ['icon-192.png', 192, { corner: 0.22, glyphSpan: 0.5 }],
  ['icon-512.png', 512, { corner: 0.22, glyphSpan: 0.5 }],
  // Maskable: full-bleed, glyph inside the 80% safe zone
  ['maskable-512.png', 512, { corner: 0, glyphSpan: 0.4 }],
  // iOS masks it itself and shows transparency as black — keep it opaque
  ['apple-touch-icon.png', 180, { corner: 0, glyphSpan: 0.48 }],
]

mkdirSync(OUT, { recursive: true })
for (const [name, size, opts] of ICONS) {
  const png = render(size, opts)
  writeFileSync(join(OUT, name), png)
  console.log(`public/icons/${name}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`)
}
