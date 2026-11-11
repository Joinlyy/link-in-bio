import { useEffect, useState } from 'react'

const KEY = 'lib_consent'
const GA4_RE = /^G-[A-Z0-9]{4,16}$/
const PIXEL_RE = /^\d{6,20}$/

function readConsent() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function loadGa4(id) {
  if (document.getElementById('ga4-src')) return
  const s = document.createElement('script')
  s.id = 'ga4-src'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', id, { anonymize_ip: true })
}

function loadPixel(id) {
  if (window.fbq) return
  const fbq = function (...args) {
    fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args)
  }
  fbq.queue = []
  fbq.loaded = true
  fbq.version = '2.0'
  window.fbq = window._fbq = fbq
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)
  fbq('init', id)
  fbq('track', 'PageView')
}

/**
 * Creator-added GA4 / Meta Pixel. These set third-party cookies, so they only load
 * after the visitor accepts. Our own analytics are cookie-less and always on.
 */
export default function ConsentAndPixels({ tracking, lang }) {
  const ga4 = GA4_RE.test(tracking?.ga4 || '') ? tracking.ga4 : null
  const pixel = PIXEL_RE.test(tracking?.meta_pixel || '') ? tracking.meta_pixel : null
  const [consent, setConsent] = useState(readConsent)

  useEffect(() => {
    if (consent !== 'yes') return
    if (ga4) loadGa4(ga4)
    if (pixel) loadPixel(pixel)
  }, [consent, ga4, pixel])

  if ((!ga4 && !pixel) || consent) return null

  const decide = (v) => {
    try {
      localStorage.setItem(KEY, v)
    } catch {
      /* ignore */
    }
    setConsent(v)
  }
  const hi = lang === 'hi'

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md animate-fade-up rounded-3xl bg-ink p-4 text-sm text-white shadow-lift sm:p-5" role="dialog" aria-label="Cookie consent">
      <p className="leading-relaxed text-white/85">
        {hi
          ? 'यह पेज बेहतर अनुभव के लिए Google Analytics / Meta Pixel कुकीज़ का उपयोग करना चाहता है।'
          : 'This page would like to use Google Analytics / Meta Pixel cookies to understand visits.'}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => decide('yes')} className="h-10 flex-1 rounded-full bg-lime font-semibold text-ink">
          {hi ? 'स्वीकार करें' : 'Accept'}
        </button>
        <button type="button" onClick={() => decide('no')} className="h-10 flex-1 rounded-full bg-white/10 font-semibold">
          {hi ? 'अस्वीकार करें' : 'Decline'}
        </button>
      </div>
    </div>
  )
}
