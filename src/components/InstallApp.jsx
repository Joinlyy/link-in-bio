import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { APP_NAME } from '../lib/config'

// The browser may fire `beforeinstallprompt` before the dashboard mounts — keep it at module level.
let deferredPrompt = null
const listeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    listeners.forEach((fn) => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((fn) => fn())
  })
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIosSafari() {
  const ua = window.navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
}

const itemCls = 'flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-[15px] font-medium text-ink-600 transition hover:bg-cream hover:text-ink'

/** "Install app" entry for the dashboard sidebar. Renders nothing when installed or not installable. */
export default function InstallAppButton() {
  const [, rerender] = useState(0)
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && isStandalone())
  const [showIosHint, setShowIosHint] = useState(false)
  const [ios] = useState(() => typeof window !== 'undefined' && isIosSafari())

  useEffect(() => {
    const update = () => {
      setInstalled(isStandalone())
      rerender((n) => n + 1)
    }
    listeners.add(update)
    const mq = window.matchMedia?.('(display-mode: standalone)')
    mq?.addEventListener?.('change', update)
    return () => {
      listeners.delete(update)
      mq?.removeEventListener?.('change', update)
    }
  }, [])

  if (installed) return null

  if (deferredPrompt) {
    return (
      <button
        type="button"
        className={`${itemCls} mt-2 bg-lime text-ink hover:bg-lime hover:brightness-95`}
        onClick={async () => {
          const prompt = deferredPrompt
          deferredPrompt = null
          prompt.prompt()
          const { outcome } = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }))
          if (outcome === 'accepted') setInstalled(true)
          rerender((n) => n + 1)
        }}
      >
        <Download className="size-[18px]" /> Install app
      </button>
    )
  }

  if (ios) {
    return (
      <div className="mt-2">
        <button type="button" className={itemCls} onClick={() => setShowIosHint((v) => !v)} aria-expanded={showIosHint}>
          <SquarePlus className="size-[18px]" /> Add to Home Screen
        </button>
        {showIosHint && (
          <div className="relative mt-1 rounded-2xl bg-lilac-100 p-3 pr-9 text-xs leading-relaxed text-ink">
            <button type="button" onClick={() => setShowIosHint(false)} className="absolute top-2 right-2 grid size-6 place-items-center rounded-full hover:bg-white/60" aria-label="Close">
              <X className="size-3.5" />
            </button>
            Install {APP_NAME} on your iPhone: tap <Share className="inline size-3.5 align-[-2px]" /> <b>Share</b> in Safari, then <b>Add to Home Screen</b>.
          </div>
        )}
      </div>
    )
  }

  return null
}
