// First-party, cookie-less analytics. A random visitor id lives in localStorage
// (no personal data) and is only used to estimate unique visitors.
import { sendEvent } from './publicApi'

function visitorId() {
  try {
    let id = localStorage.getItem('lib_vid')
    if (!id) {
      id = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('lib_vid', id)
    }
    return id
  } catch {
    return null
  }
}

function utmParam(name, max) {
  try {
    const v = new URLSearchParams(window.location.search).get(name)
    return v ? v.trim().toLowerCase().slice(0, max) || null : null
  } catch {
    return null
  }
}

function detectSource() {
  const params = new URLSearchParams(window.location.search)
  const utm = params.get('utm_source') || params.get('src')
  if (utm) return utm.toLowerCase().slice(0, 32)

  const ua = navigator.userAgent
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'

  let host = ''
  try {
    host = document.referrer ? new URL(document.referrer).hostname : ''
  } catch {
    host = ''
  }
  if (!host || host === window.location.hostname) return 'direct'
  if (/instagram\./.test(host)) return 'instagram'
  if (/youtube\.|youtu\.be/.test(host)) return 'youtube'
  if (/whatsapp\.|wa\.me/.test(host)) return 'whatsapp'
  if (/facebook\.|fb\.me/.test(host)) return 'facebook'
  if (/(^|\.)t\.co$|twitter\.|x\.com/.test(host)) return 'x'
  if (/google\./.test(host)) return 'google'
  if (/snapchat\./.test(host)) return 'snapchat'
  if (/sharechat\./.test(host)) return 'sharechat'
  if (/linkedin\./.test(host)) return 'linkedin'
  if (/t\.me|telegram\./.test(host)) return 'telegram'
  return 'other'
}

function detectClient() {
  const ua = navigator.userAgent
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop'
  const browser = /Instagram/i.test(ua)
    ? 'instagram'
    : /FBAN|FBAV/i.test(ua)
      ? 'facebook'
      : /SamsungBrowser/i.test(ua)
        ? 'samsung'
        : /Edg\//i.test(ua)
          ? 'edge'
          : /OPR\/|Opera/i.test(ua)
            ? 'opera'
            : /Firefox|FxiOS/i.test(ua)
              ? 'firefox'
              : /Chrome|CriOS/i.test(ua)
                ? 'chrome'
                : /Safari/i.test(ua)
                  ? 'safari'
                  : 'other'
  const os = /Android/i.test(ua)
    ? 'android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'ios'
      : /Windows/i.test(ua)
        ? 'windows'
        : /Mac OS/i.test(ua)
          ? 'macos'
          : /Linux/i.test(ua)
            ? 'linux'
            : 'other'
  return { device, browser, os }
}

let context
function ctx() {
  if (!context) {
    context = {
      visitor: visitorId(),
      source: detectSource(),
      medium: utmParam('utm_medium', 32),
      campaign: utmParam('utm_campaign', 64),
      ...detectClient(),
    }
  }
  return context
}

/** Shared payload fields for every event */
function base(pageId, type) {
  const c = ctx()
  return {
    p_page_id: pageId,
    p_type: type,
    p_visitor: c.visitor,
    p_source: c.source,
    p_device: c.device,
    p_browser: c.browser,
    p_os: c.os,
    p_medium: c.medium,
    p_campaign: c.campaign,
  }
}

/**
 * In production, events go through the /api/track edge function (adds state/city
 * from Vercel's geo headers). If that fails we fall back to the direct RPC.
 */
function send(payload) {
  if (!import.meta.env.PROD) return sendEvent(payload)
  return fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`track ${res.status}`)
    })
    .catch(() => sendEvent(payload))
}

function isBot() {
  return /bot|crawl|spider|preview|facebookexternalhit|WhatsApp\/|Slackbot|TelegramBot/i.test(navigator.userAgent)
}

export function trackView(pageId) {
  if (isBot()) return
  const key = `lib_v_${pageId}`
  try {
    if (sessionStorage.getItem(key)) return // one view per session per page
    sessionStorage.setItem(key, '1')
  } catch {
    /* storage blocked: still count */
  }
  send(base(pageId, 'view'))
}

export function trackClick(pageId, blockId) {
  if (isBot()) return
  send({ ...base(pageId, 'click'), p_block_id: blockId })
}

/** A visitor opened a product page (funnel step between clicks and purchases) */
export function trackProductView(pageId, productId) {
  if (isBot()) return
  send({ ...base(pageId, 'product_view'), p_block_id: productId })
}
