import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BookOpen, CircleHelp, Lightbulb, X } from 'lucide-react'
import { findFlow } from '../lib/helpFlows'

/** One step: a number, what to do in bold, what it means in plain words, and a button that takes you there */
function Step({ n, last, step, onGo }) {
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!last && <span className="absolute top-9 bottom-0 left-[15px] w-0.5 bg-ink/15" aria-hidden />}
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-lime">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[15.5px] leading-snug font-bold">{step.t}</p>
        {step.d && <p className="mt-1 text-[14px] leading-relaxed text-ink-600">{step.d}</p>}
        {step.go && (
          <Link to={step.go[1]} onClick={onGo} className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-4 text-[13px] font-bold text-ink hover:brightness-95">
            {step.go[0]} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </li>
  )
}

function Heading({ children }) {
  return <h3 className="mb-3.5 font-display text-[17px] font-bold tracking-tight">{children}</h3>
}

/** A book tab on the side of every dashboard page. It opens a slide-in guide for that page. */
export default function HelpSlide() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const closeRef = useRef(null)
  const bodyRef = useRef(null)
  const flow = findFlow(pathname)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    bodyRef.current?.scrollTo({ top: 0 })
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!flow) return null
  const close = () => setOpen(false)
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
        <button type="button" tabIndex={-1} onClick={close} aria-label="Close help" className={`absolute inset-0 bg-ink/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
        <aside
          role="dialog"
          aria-label={`Help: ${flow.title}`}
          className={`absolute top-0 right-0 flex h-full w-[min(94vw,440px)] flex-col bg-cream shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-start justify-between gap-3 bg-white p-5 shadow-sm">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase"><BookOpen className="size-3.5" /> Help guide</p>
              <h2 className="mt-1.5 font-display text-[22px] leading-tight font-bold tracking-tight">{flow.title}</h2>
            </div>
            <button ref={closeRef} type="button" onClick={close} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-cream hover:bg-cream-300">
              <X className="size-4" />
            </button>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-7 overflow-y-auto p-5">
            <p className="rounded-2xl bg-lilac-100 p-4 text-[14.5px] leading-relaxed">
              <b className="block text-[11px] tracking-[0.14em] uppercase">What this page is for</b>
              <span className="mt-1.5 block">{flow.purpose}</span>
            </p>

            {flow.flows.map((f) => (
              <section key={f.name}>
                <Heading>{f.name}</Heading>
                <ol>
                  {f.steps.map((step, i) => (
                    <Step key={step.t} n={i + 1} last={i === f.steps.length - 1} step={step} onGo={close} />
                  ))}
                </ol>
              </section>
            ))}

            {flow.map && (
              <section>
                <Heading>Where to find things</Heading>
                <ul className="space-y-2.5">
                  {flow.map.map(([label, to, summary, bullets]) => (
                    <li key={label}>
                      <Link to={to} onClick={close} className="group block rounded-2xl bg-white p-4 shadow-soft transition hover:-translate-y-0.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[15.5px] font-bold">{label}</span>
                          <ArrowUpRight className="size-4 shrink-0 text-ink-400 transition group-hover:text-ink" />
                        </span>
                        <span className="mt-0.5 block text-[13.5px] font-medium text-ink-600">{summary}</span>
                        <ul className="mt-2 space-y-1 text-[13px] text-ink-600">
                          {bullets.map((b) => <li key={b} className="flex gap-2"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink/40" />{b}</li>)}
                        </ul>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {flow.tips?.length > 0 && (
              <section className="rounded-2xl bg-lime-200 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] uppercase"><Lightbulb className="size-3.5" /> Good to know</p>
                <ul className="mt-2.5 space-y-2 text-[14px] leading-relaxed">
                  {flow.tips.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </section>
            )}

            {flow.stuck?.length > 0 && (
              <section>
                <Heading>Stuck?</Heading>
                <div className="space-y-2">
                  {flow.stuck.map(([q, a]) => (
                    <details key={q} className="group rounded-2xl bg-white p-4 shadow-soft">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-[14.5px] font-bold">
                        <CircleHelp className="size-4 shrink-0 text-ink-400" /> {q}
                      </summary>
                      <p className="mt-2.5 text-[14px] leading-relaxed text-ink-600">{a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="flex gap-2 bg-white p-4 shadow-[0_-1px_0_rgba(0,0,0,0.05)]">
            <Link to="/dashboard/guide" onClick={close} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white">Full guide <ArrowUpRight className="size-4" /></Link>
            <Link to="/dashboard/messages" onClick={close} className="flex h-11 flex-1 items-center justify-center rounded-full bg-cream px-4 text-sm font-semibold hover:bg-cream-300">Ask our team</Link>
          </div>
        </aside>
      </div>
    </>
  )
}
