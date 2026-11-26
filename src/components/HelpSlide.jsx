import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, BookOpen, X } from 'lucide-react'
import { findFlow } from '../lib/helpFlows'

/** Steps as a short vertical chain: number, title, tiny hint, a line down to the next step */
function Chain({ steps }) {
  return (
    <ol>
      {steps.map(([title, hint], i) => (
        <li key={`${title}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span className="absolute top-8 bottom-0 left-[13px] w-px bg-ink/15" aria-hidden />}
          <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-lime text-xs font-bold">{i + 1}</span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[14.5px] leading-snug font-semibold">{title}</p>
            {hint && <p className="mt-0.5 text-xs leading-snug text-ink-500">{hint}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** A book tab on the side of every dashboard page. It opens a slide-in guide for that page. */
export default function HelpSlide() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const closeRef = useRef(null)
  const flow = findFlow(pathname)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!flow) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the help guide for this page"
        aria-expanded={open}
        className="no-print fixed top-1/2 right-0 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-2xl bg-ink px-2.5 py-3.5 text-white shadow-lg transition hover:pr-3.5"
      >
        <BookOpen className="size-5" />
        <span className="text-[10px] font-bold tracking-wider [writing-mode:vertical-rl]">HELP</span>
      </button>

      <div className={`no-print fixed inset-0 z-[70] transition ${open ? 'visible' : 'invisible'}`} aria-hidden={!open}>
        <button type="button" tabIndex={-1} onClick={() => setOpen(false)} aria-label="Close help" className={`absolute inset-0 bg-ink/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
        <aside
          role="dialog"
          aria-label={`Help: ${flow.title}`}
          className={`absolute top-0 right-0 flex h-full w-[min(92vw,400px)] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
            <div className="min-w-0">
              <p className="eyebrow text-ink-500">Help guide</p>
              <h2 className="mt-1 font-display text-xl leading-tight font-bold">{flow.title}</h2>
              <p className="mt-1 text-sm leading-snug text-ink-600">{flow.intro}</p>
            </div>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-cream hover:bg-cream-300">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {flow.flows.map((f) => (
              <section key={f.name}>
                <h3 className="mb-3 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">{f.name}</h3>
                <Chain steps={f.steps} />
              </section>
            ))}

            {flow.map && (
              <section>
                <h3 className="mb-3 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Where to find things</h3>
                <ul className="space-y-2">
                  {flow.map.map(([label, to, text]) => (
                    <li key={label}>
                      <Link to={to} onClick={() => setOpen(false)} className="group flex items-start gap-3 rounded-2xl bg-cream p-3.5 transition hover:bg-cream-300">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{label}</p>
                          <p className="mt-0.5 text-xs leading-snug text-ink-600">{text}</p>
                        </div>
                        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-ink-400 transition group-hover:text-ink" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="border-t border-ink/10 p-4">
            <Link to="/dashboard/guide" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
              Open the full guide <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
