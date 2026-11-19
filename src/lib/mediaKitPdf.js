// Builds the media kit PDF in the browser and downloads it: no print dialog.
//
// The PDF is the same media kit people see on screen (same component, same colours), laid out as A4 pages.
// How it works:
//   1. The kit is rendered into a hidden, desktop-width iframe, so the layout is the same on phones.
//   2. Images (profile photo, recent posts) are first copied into data URLs, so nothing taints the canvas.
//   3. Each section is captured as an image (html2canvas) and placed on the page, never split across two pages.
//   4. Links (email, page, Instagram posts, socials) stay clickable in the PDF.
// Loaded only when someone clicks Download (dynamic import), so it never weighs down the public page.
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import MediaKitView from '../components/MediaKitView'
import { APP_NAME } from './config'

const VIEWPORT = 1024 // desktop layout, whatever the screen the button was clicked on
const A4 = { w: 210, h: 297 } // mm
const MARGIN = 10
const GAP_PX = 16 // space between cards, as on screen
const PAGE_BG = '#F2F1EC' // cream

/** Copies a remote image into a data URL (needs CORS, which Instagram's and our image hosts send). null on failure. */
function toDataUrl(url, { max = 900, type = 'image/jpeg' } = {}) {
  if (!url) return Promise.resolve(null)
  if (url.startsWith('data:')) return Promise.resolve(url)
  return new Promise((resolve) => {
    const img = new Image()
    const timer = setTimeout(() => resolve(null), 10_000)
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.onload = () => {
      clearTimeout(timer)
      try {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL(type, 0.9))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    img.src = url
  })
}

/** Resolves when an image has loaded (or failed), never hangs: decode() can stall for images in a hidden frame */
function settle(img, ms = 4000) {
  if (img.complete) return Promise.resolve()
  return new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true })
    img.addEventListener('error', resolve, { once: true })
    setTimeout(resolve, ms)
  })
}

/** A hidden iframe as wide as a desktop screen, carrying the app's stylesheets */
async function createStage() {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  Object.assign(iframe.style, {
    position: 'fixed', left: '-10000px', top: '0', width: `${VIEWPORT}px`, height: '1400px',
    border: '0', opacity: '0', pointerEvents: 'none',
  })
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  doc.open()
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
  doc.close()
  doc.documentElement.className = document.documentElement.className
  doc.documentElement.lang = document.documentElement.lang

  const loading = []
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    const copy = node.cloneNode(true)
    doc.head.appendChild(copy)
    if (copy.tagName === 'LINK') {
      loading.push(new Promise((resolve) => {
        copy.onload = copy.onerror = resolve
        setTimeout(resolve, 8000)
      }))
    }
  })
  await Promise.all(loading)
  doc.body.style.cssText = `margin:0;background:${PAGE_BG}`
  return { iframe, doc }
}

/**
 * @param page       the page row (display_name, username, niche, language, avatar_url, socials, media_kit)
 * @param instagram  the connected Instagram account row, or null
 */
export async function downloadMediaKitPdf(page, instagram) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])

  // Images first: failed ones simply drop out (initials / empty tile)
  const avatar = await toDataUrl(page.avatar_url || instagram?.profile_picture_url, { max: 400, type: 'image/png' })
  const ig = instagram
    ? {
        ...instagram,
        profile_picture_url: avatar,
        recent_media: await Promise.all(
          (instagram.recent_media || []).slice(0, 6).map(async (m) => ({ ...m, image: await toDataUrl(m.image) })),
        ),
      }
    : null
  const kitPage = { ...page, avatar_url: avatar }

  const { iframe, doc } = await createStage()
  const mount = doc.createElement('div')
  doc.body.appendChild(mount)
  const root = createRoot(mount)
  try {
    flushSync(() => root.render(createElement(MediaKitView, { page: kitPage, instagram: ig })))
    const kit = mount.firstElementChild
    await doc.fonts.ready
    doc.querySelectorAll('img').forEach((img) => { img.loading = 'eager' })
    await Promise.all([...doc.images].map(settle))
    await new Promise((resolve) => setTimeout(resolve, 150))

    const kitWidth = kit.getBoundingClientRect().width
    const mmPerPx = (A4.w - 2 * MARGIN) / kitWidth
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
    pdf.setProperties({
      title: `${page.display_name || page.username} — Media kit`,
      author: page.display_name || page.username,
      creator: APP_NAME,
    })
    const paint = () => {
      pdf.setFillColor(242, 241, 236)
      pdf.rect(0, 0, A4.w, A4.h, 'F')
    }
    paint()

    let y = MARGIN
    for (const section of kit.children) {
      const rect = section.getBoundingClientRect()
      if (!rect.height) continue
      let w = rect.width * mmPerPx
      let h = rect.height * mmPerPx
      const room = A4.h - 2 * MARGIN
      if (h > room) { // taller than a page: shrink to fit rather than cut
        w *= room / h
        h = room
      }
      if (y + h > A4.h - MARGIN && y > MARGIN + 0.1) {
        pdf.addPage()
        paint()
        y = MARGIN
      }
      const x = (A4.w - w) / 2
      const canvas = await html2canvas(section, {
        scale: 2, useCORS: true, logging: false, backgroundColor: PAGE_BG, windowWidth: VIEWPORT,
      })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h, undefined, 'FAST')

      // Keep links clickable
      const k = w / rect.width
      section.querySelectorAll('a[href]').forEach((a) => {
        const r = a.getBoundingClientRect()
        if (!r.width || !r.height || !/^(https?:|mailto:)/.test(a.href)) return
        pdf.link(x + (r.left - rect.left) * k, y + (r.top - rect.top) * k, r.width * k, r.height * k, { url: a.href })
      })
      y += h + GAP_PX * mmPerPx
    }

    const name = (page.username || 'creator').replace(/[^a-z0-9._-]+/gi, '-')
    pdf.save(`${name}-media-kit.pdf`)
  } finally {
    root.unmount()
    iframe.remove()
  }
}
