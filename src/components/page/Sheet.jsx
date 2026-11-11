import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../icons'

/** Bottom sheet on phones, centred dialog on larger screens */
export default function Sheet({ title, onClose, children, wide = false, xl = false, hideTitle = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div
        className={`relative max-h-[92dvh] w-full animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-5 text-ink shadow-lift sm:rounded-3xl sm:p-7 ${xl ? 'sm:max-w-5xl' : wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className={`flex items-center justify-between gap-4 ${hideTitle ? 'mb-2' : 'mb-4'}`}>
          <h2 className={hideTitle ? 'sr-only' : 'font-display text-xl font-bold tracking-tight'}>{title}</h2>
          {hideTitle && <span />}
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-cream transition hover:bg-cream-300" aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
