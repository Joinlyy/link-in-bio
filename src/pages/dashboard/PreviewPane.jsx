import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, Monitor, X } from 'lucide-react'
import DesktopPreview from '../../components/DesktopPreview'
import PageRenderer from '../../components/page/PageRenderer'
import PhoneFrame from '../../components/PhoneFrame'
import { usePage } from '../../context/PageContext'

function LiveSite({ device, visitorView, onEdited }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { page, blocks, products, sitePages, sitePageId, setSitePageId, setEditTarget, instagram } = usePage()
  const goEdit = (target) => {
    onEdited?.()
    const blockId = target.split(':')[0]
    if (target === 'settings') return navigate('/dashboard/settings')
    if (blocks.find((b) => b.id === blockId)?.type === 'products') return navigate('/dashboard/products')
    setEditTarget(target)
    if (pathname !== '/dashboard/editor') navigate('/dashboard/editor')
  }
  const now = Date.now()
  const visible = blocks.filter(
    (b) =>
      (b.site_page_id ?? null) === sitePageId &&
      (!visitorView || !b.data?.sample || b.type === 'products') &&
      b.is_active && (!b.starts_at || new Date(b.starts_at) <= now) && (!b.ends_at || new Date(b.ends_at) > now),
  )
  const nav = sitePages
    .filter((s) => s.is_published && s.show_in_nav)
    .filter((s) => !visitorView || blocks.some((b) => b.site_page_id === s.id && b.is_active && (b.type === 'products' ? products.some((p) => p.is_published && p.show_on_page !== false) : !b.data?.sample)))
    .map((s) => ({ slug: s.slug, label: s.nav_label || s.title, members: s.visibility === 'members' }))
  const current = sitePages.find((s) => s.id === sitePageId)
  const reel = (instagram?.recent_media || []).find((m) => m.media_product_type === 'REELS' || m.media_type === 'VIDEO')?.permalink
  return (
      <PageRenderer
        device={device}
        page={page}
        blocks={visible}
        products={products.filter((p) => p.is_published)}
        nav={nav}
        sitePage={current ? { slug: current.slug, title: current.title } : null}
        onNavigate={(slug) => setSitePageId(slug ? sitePages.find((s) => s.slug === slug)?.id ?? null : null)}
        latestReel={reel}
        preview
        markSamples={!visitorView}
        onEdit={device === 'phone' && !visitorView ? goEdit : null}
        onEditLink={goEdit}
        hideSampleProducts={visitorView}
      />
  )
}

function LivePreview({ height, visitorView, onEdited }) {
  return (
    <PhoneFrame height={height}>
      <LiveSite device="phone" visitorView={visitorView} onEdited={onEdited} />
    </PhoneFrame>
  )
}

function ViewSwitch({ visitorView, onChange }) {
  return (
    <div className="mx-auto mb-3 flex w-fit gap-1 rounded-full bg-white p-1 shadow-soft" role="group" aria-label="Preview">
      {[[true, 'What visitors see'], [false, 'With examples']].map(([value, label]) => (
        <button key={label} type="button" aria-pressed={visitorView === value} onClick={() => onChange(value)} className={`h-8 rounded-full px-3 text-xs font-semibold ${visitorView === value ? 'bg-ink text-white' : 'text-ink-600'}`}>{label}</button>
      ))}
    </div>
  )
}

/** Sticky phone preview on desktop, floating button + full-screen sheet on mobile */
export default function PreviewPane() {
  const [open, setOpen] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [visitorView, setVisitorView] = useState(true)
  // The dashboard behind must not scroll along with the preview
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])
  return (
    <>
      {desktop && <DesktopPreview onClose={() => setDesktop(false)}><LiveSite device="desktop" visitorView={visitorView} onEdited={() => setDesktop(false)} /></DesktopPreview>}
      <div className="hidden xl:block">
        <div className="sticky top-28">
          <ViewSwitch visitorView={visitorView} onChange={setVisitorView} />
          <LivePreview height={600} visitorView={visitorView} />
          <button type="button" onClick={() => setDesktop(true)} className="mx-auto mt-3 flex h-10 items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold">
            <Monitor className="size-4" /> See desktop view
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-lift xl:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Eye className="size-4" /> Preview
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center bg-cream p-3 xl:hidden" role="dialog" aria-modal="true" aria-label="Preview">
          <div className="mb-3 flex w-full max-w-[320px] items-center justify-between gap-2">
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-white">
              <X className="size-4" /> Close
            </button>
            <button type="button" onClick={() => setDesktop(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 text-sm font-semibold">
              <Monitor className="size-4" /> Desktop view
            </button>
          </div>
          <ViewSwitch visitorView={visitorView} onChange={setVisitorView} />
          <LivePreview height="min(680px, calc(100dvh - 136px))" visitorView={visitorView} onEdited={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
