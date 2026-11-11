import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, Monitor, X } from 'lucide-react'
import DesktopPreview from './DesktopPreview'
import { hasOwnContent, sitePreview, STARTER_TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATES, templatePreview } from '../lib/templates'
import PageRenderer from './page/PageRenderer'
import PhoneFrame from './PhoneFrame'
import { Button } from './ui'

/** The creator's own site in a design once they've made something; otherwise the design's example */
function previewOf(template, page, slug, content) {
  return content?.sitePages && hasOwnContent(content.blocks) ? sitePreview(template, page, slug, content) : templatePreview(template, page, slug, content?.blocks)
}

function Site({ template, page, device, content }) {
  const [slug, setSlug] = useState(null)
  useEffect(() => setSlug(null), [template.id])
  const p = previewOf(template, page, slug, content)
  return <PageRenderer key={template.id} device={device} page={p.page} blocks={p.blocks} products={content?.products} nav={p.nav} sitePage={p.sitePage} onNavigate={setSlug} preview />
}

function Preview({ template, page, height, content }) {
  return (
    <PhoneFrame height={height}>
      <Site template={template} page={page} device="phone" content={content} />
    </PhoneFrame>
  )
}

/** Non-interactive live miniature of a template */
function Thumb({ template, page, content }) {
  const p = useMemo(() => previewOf(template, page, null, content), [template, page, content])
  // Render each miniature only once it nears the screen, so the gallery stays light on phones
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '300px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="relative h-56 overflow-hidden bg-cream-200" aria-hidden>
      {visible && (
      <div className="pointer-events-none absolute top-3 left-1/2 w-[375px] origin-top -translate-x-1/2 scale-[0.46] overflow-hidden rounded-[32px] shadow-soft" inert>
        <PageRenderer page={p.page} blocks={p.blocks} products={content?.products} nav={p.nav} preview thumbnail />
      </div>
      )}
    </div>
  )
}

/**
 * Template gallery with a phone preview on the right.
 * Phones get a full-screen preview instead, opened by tapping a template.
 */
export default function TemplatePicker({ page, onUse, busy, useLabel = 'Use this template', initialId, footer, content }) {
  const [category, setCategory] = useState('All')
  const [showAll, setShowAll] = useState(false)
  const [selectedId, setSelectedId] = useState(initialId || TEMPLATES[0].id)
  const [sheet, setSheet] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const selected = TEMPLATES.find((t) => t.id === selectedId) || TEMPLATES[0]
  const list = TEMPLATES.filter((t) => (showAll || STARTER_TEMPLATES.includes(t.id) || t.id === initialId || t.id === page?.theme?.template) && (category === 'All' || t.category === category))

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {desktop && <DesktopPreview onClose={() => setDesktop(false)}><Site template={selected} page={page} device="desktop" content={content} /></DesktopPreview>}
      <div className="min-w-0">
        <p className="mb-2 px-1 text-sm text-ink-600">Each design has its own header, fonts, buttons and section layout.{content?.sitePages && hasOwnContent(content.blocks) ? ' The previews show your own site.' : ''}</p>
        {showAll && <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition ${category === c ? 'bg-ink text-white' : 'bg-white text-ink-600 shadow-soft hover:text-ink'}`}>
              {c}
            </button>
          ))}
        </div>}
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
          {list.map((t) => {
            const active = t.id === selected.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedId(t.id)
                  setSheet(true)
                }}
                className={`card overflow-hidden text-left transition hover:-translate-y-0.5 ${active ? 'ring-2 ring-ink' : ''}`}
                aria-pressed={active}
              >
                <Thumb template={t} page={page} content={content} />
                <span className="block border-t border-ink/5 p-3">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{t.name}</span>
                    {page?.theme?.template === t.id && <span className="shrink-0 rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold">Current</span>}
                    {active && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-lime"><Check className="size-3" strokeWidth={3} /></span>}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-500">{t.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>
        {!showAll && <button type="button" onClick={() => setShowAll(true)} className="mx-auto mt-4 block h-11 rounded-full bg-white px-5 text-sm font-semibold shadow-soft">See all {TEMPLATES.length} designs</button>}
        {footer}
      </div>

      {/* Desktop: sticky phone on the right */}
      <aside className="hidden xl:block">
        <div className="sticky top-28">
          <Preview template={selected} page={page} height={560} content={content} />
          <p className="mt-3 text-center text-sm font-bold">{selected.name}</p>
          <button type="button" onClick={() => setDesktop(true)} className="mx-auto mt-2 flex h-9 items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-xs font-semibold">
            <Monitor className="size-3.5" /> See desktop view
          </button>
          <Button size="lg" className="mt-3 w-full" loading={busy} onClick={() => onUse(selected)} arrow>{useLabel}</Button>
        </div>
      </aside>

      {/* Phones and tablets: full-screen preview */}
      {sheet && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-cream/95 p-4 backdrop-blur xl:hidden" role="dialog" aria-modal="true" aria-label={`${selected.name} preview`}>
          <Preview template={selected} page={page} height={Math.min(620, window.innerHeight - 170)} content={content} />
          <div className="flex w-full max-w-[320px] gap-2">
            <Button variant="outline" size="lg" onClick={() => setSheet(false)} aria-label="Close preview"><X className="size-4" /></Button>
            <Button size="lg" className="flex-1" loading={busy} onClick={() => onUse(selected)}>{useLabel} <ArrowUpRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
