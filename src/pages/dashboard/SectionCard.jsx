import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, CalendarClock, ChevronDown, CircleAlert, Eye, EyeOff, Trash2 } from 'lucide-react'
import { Alert, Button, Input, Select, Toggle, askConfirm, useToast } from '../../components/ui'
import { usePage } from '../../context/PageContext'
import { BLOCK_TYPES, blockIsComplete, blockSummary, ONE_PER_SITE } from './blockTypes'
import BlockFields from './BlockFields'

const toIstInput = (ts) => (ts ? new Date(new Date(ts).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : '')
const fromIstInput = (v) => (v ? new Date(`${v}:00+05:30`).toISOString() : null)

function ScheduleFields({ block, onChange }) {
  const [open, setOpen] = useState(Boolean(block.starts_at || block.ends_at))
  const now = Date.now()
  const state = block.starts_at && new Date(block.starts_at) > now ? 'Scheduled' : block.ends_at && new Date(block.ends_at) <= now ? 'Expired' : null
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink">
        <CalendarClock className="size-4" /> Schedule
      </button>
    )
  }
  return (
    <div className="rounded-2xl bg-cream p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarClock className="size-4" /> Schedule (IST) {state && <span className="rounded-full bg-white px-2 py-0.5 text-xs">{state}</span>}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input label="Show from" type="datetime-local" value={toIstInput(block.starts_at)} onChange={(e) => onChange({ starts_at: fromIstInput(e.target.value) })} />
        <Input label="Hide after" type="datetime-local" value={toIstInput(block.ends_at)} onChange={(e) => onChange({ ends_at: fromIstInput(e.target.value) })} />
      </div>
    </div>
  )
}

// Sections holding several example items, like reviews
const LIST_TYPES = ['testimonials', 'faq', 'cards']

/**
 * An edit makes a section the creator's own, so it can go live. In a list, only the items they
 * changed go live: the other examples are dropped, and renaming the section alone changes nothing.
 */
function ownEdit(block, patch) {
  if (!patch.data || !block.data?.sample) return patch
  if (!LIST_TYPES.includes(block.type)) return { ...patch, data: { ...patch.data, sample: false } }
  if (!patch.data.items) return patch
  const before = (block.data.items || []).map((item) => JSON.stringify(item))
  return { ...patch, data: { ...patch.data, sample: false, items: patch.data.items.filter((item) => !before.includes(JSON.stringify(item))) } }
}

const onSamePage = (a, b) => (a.site_page_id ?? null) === (b.site_page_id ?? null)

/** Puts a section on Home or back on its own page, and moves it up or down its page */
function PlaceControls({ block }) {
  const { blocks, sitePages, updateBlock, reorderBlocks, autoPage, setSitePageId, canEdit } = usePage()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!canEdit) return null
  const siblings = blocks.filter((b) => onSamePage(b, block)).sort((a, b) => a.position - b.position)
  const index = siblings.findIndex((b) => b.id === block.id)
  const onHome = !block.site_page_id
  const lastPosition = Math.max(0, ...blocks.map((b) => b.position))

  // The section is drawn again inside its new page, so follow it there
  function follow(id, sitePage) {
    setSitePageId(sitePage)
    setTimeout(() => document.getElementById(`section-${id}`)?.scrollIntoView({ block: 'start' }), 150)
  }

  async function backToOwnPage(target) {
    const saved = target.data?.home_from
    const sitePage = sitePages.some((s) => s.id === saved) ? saved : await autoPage(target.type === 'products' || target.type === 'tip' ? 'shop' : 'content')
    if (!sitePage) return
    updateBlock(target.id, { site_page_id: sitePage, position: lastPosition + 1 })
    toast(`Moved to ${sitePages.find((s) => s.id === sitePage)?.title || 'its own page'}`)
    follow(target.id, sitePage)
  }

  async function setHome(on) {
    setBusy(true)
    if (on) {
      updateBlock(block.id, { site_page_id: null, position: lastPosition + 1, data: { home_from: block.site_page_id } })
      toast('Moved to the bottom of Home. Use the arrows to place it.')
      follow(block.id, null)
    } else {
      await backToOwnPage(block)
    }
    setBusy(false)
  }

  function move(dir) {
    const ids = siblings.map((b) => b.id)
    ;[ids[index], ids[index + dir]] = [ids[index + dir], ids[index]]
    reorderBlocks(ids)
  }

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-cream p-3">
      {block.type !== 'lead_form' ? (
        <div className="min-w-0 flex-1 basis-56">
          <Toggle label="Show on Home" disabled={busy} checked={onHome} onChange={setHome} />
        </div>
      ) : <span className="text-sm font-semibold">Always on Home</span>}
      {siblings.length > 1 && (
        <span className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-sm font-semibold">Move</span>
          <button type="button" disabled={index === 0} onClick={() => move(-1)} className="grid size-9 place-items-center rounded-full bg-white disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-4" /></button>
          <button type="button" disabled={index === siblings.length - 1} onClick={() => move(1)} className="grid size-9 place-items-center rounded-full bg-white disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-4" /></button>
        </span>
      )}
    </div>
  )
}

/** One section of the site: show or hide it, open it to edit, delete it */
export default function SectionCard({ block, open, onToggle, handle, note, rootRef, style, dragging, bare = false }) {
  const { updateBlock, removeBlock, sitePages, blocks } = usePage()
  const meta = BLOCK_TYPES[block.type]
  const Icon = meta?.icon
  const complete = blockIsComplete(block)
  const sample = block.data?.sample && block.type !== 'products'
  const sampleLink = block.type !== 'products' && JSON.stringify(block.data || {}).includes('https://example.com')

  // Closing another section can move this one off screen: bring its top back
  useEffect(() => {
    if (!open || bare) return
    const el = document.getElementById(`section-${block.id}`)
    if (el && el.getBoundingClientRect().top < 64) el.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [open, block.id, bare])

  return (
    <div
      id={`section-${block.id}`}
      ref={rootRef}
      style={style}
      className={`${bare ? '' : 'card'} scroll-mt-16 overflow-hidden ${dragging ? 'relative z-10 shadow-lift ring-2 ring-lilac' : ''} ${block.is_active ? '' : 'opacity-60'}`}
    >
      {!bare && <div className="flex items-center gap-1 p-2 sm:gap-3 sm:p-3">
        {handle}
        <span className={`hidden size-10 shrink-0 place-items-center rounded-xl sm:grid ${meta?.color}`}>{Icon && <Icon size={18} className="size-[18px]" />}</span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-ink-500">
            {meta?.label}{note ? ` · ${note}` : ''}
            {sample && <span className="rounded-full bg-lilac-100 px-1.5 text-[11px] text-ink" title="Not on your site yet">Example</span>}
          </span>
          <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{blockSummary(block)}</span>
        </button>
        {!complete && (
          <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:inline-flex" title="Hidden on your page until filled in">
            <CircleAlert className="size-3.5" /> Incomplete
          </span>
        )}
        <button
          type="button"
          onClick={() => updateBlock(block.id, { is_active: !block.is_active })}
          className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-cream"
          aria-label={block.is_active ? 'Hide block' : 'Show block'}
          title={block.is_active ? 'Visible' : 'Hidden'}
        >
          {block.is_active ? <Eye className="size-[18px]" /> : <EyeOff className="size-[18px]" />}
        </button>
        <button type="button" onClick={onToggle} className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-cream" aria-label="Edit block" aria-expanded={open}>
          <ChevronDown className={`size-[18px] transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>}
      {open && (
        <div className={bare ? '' : 'border-t border-ink/5 bg-white p-4 sm:p-6'}>
          <PlaceControls block={block} />
          {sample && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lilac-100 p-3 text-sm">
              <span>This is an example, so visitors can’t see it. Only what you write here goes on your site.{sampleLink && ' Add your own link below.'}</span>
            </div>
          )}
          {!sample && sampleLink && <div className="mb-5"><Alert tone="info">A button here still has an example link. Replace it with your own, or visitors will reach an example page.</Alert></div>}
          <BlockFields block={block} onChange={(patch) => updateBlock(block.id, ownEdit(block, patch))} />
          <details className="mt-5 rounded-2xl bg-cream/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold">More options</summary>
          {sitePages.length > 0 && block.type !== 'lead_form' && block.type !== 'products' && (
            <div className="mt-5">
              <Select
                label="Show on page"
                value={block.site_page_id || ''}
                onChange={(e) => updateBlock(block.id, { site_page_id: e.target.value || null, position: Math.max(0, ...blocks.map((b) => b.position)) + 1 })}
                options={[{ value: '', label: 'Home' }, ...sitePages.map((s) => ({ value: s.id, label: s.nav_label || s.title }))]}
              />
            </div>
          )}
          <div className="mt-5">
            <ScheduleFields block={block} onChange={(patch) => updateBlock(block.id, patch)} />
          </div>
          </details>
          <div className="mt-6 flex justify-end">
            <Button
              variant="dangerSoft"
              size="sm"
              onClick={async () => {
                if (await askConfirm({ title: `Delete this ${meta?.label || 'section'}?`, confirmLabel: 'Delete' })) removeBlock(block.id)
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AddSectionButton({ type, onPick, disabled }) {
  const { blocks } = usePage()
  const meta = BLOCK_TYPES[type]
  const added = ONE_PER_SITE.includes(type) && blocks.some((b) => b.type === type)
  return (
    <button type="button" disabled={disabled} onClick={() => onPick(type)} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-soft disabled:opacity-50">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${meta.color}`}>
        <meta.icon size={18} className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{meta.label}</span>
        <span className="block truncate text-xs text-ink-500">{added ? 'Already on your site · tap to edit' : meta.desc}</span>
      </span>
    </button>
  )
}
