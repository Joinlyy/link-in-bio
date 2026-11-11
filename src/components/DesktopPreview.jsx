import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const SITE_WIDTH = 1280

/** Full-screen view of the site at desktop width, scaled to fit the window */
export default function DesktopPreview({ onClose, children }) {
  const measure = () => ({ w: window.innerWidth - 32, h: window.innerHeight - 88 })
  const [size, setSize] = useState(measure)
  useEffect(() => {
    const onResize = () => setSize(measure())
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  const scale = Math.min(1, size.w / SITE_WIDTH)

  return createPortal(
    <div className="fixed inset-0 z-[85] flex flex-col items-center bg-ink/80 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label="Desktop preview">
      <button type="button" onClick={onClose} className="mb-3 inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink">
        <X className="size-4" /> Close desktop view
      </button>
      <div className="overflow-hidden rounded-2xl bg-white shadow-lift" style={{ width: SITE_WIDTH * scale, height: size.h }}>
        <div className="overflow-x-hidden overflow-y-auto" style={{ width: SITE_WIDTH, height: size.h / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
