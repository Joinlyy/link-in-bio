import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, FileText, GripVertical, House, Plus, ShoppingBag } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import ImageInput from '../../components/ImageInput'
import { Button, Card, Input, Modal, Textarea, Toggle } from '../../components/ui'
import { WhatsappIcon } from '../../components/icons'
import { resolveTheme } from '../../lib/themes'
import { ADD_GROUPS, BLOCK_TYPES } from './blockTypes'
import SectionCard, { AddSectionButton } from './SectionCard'
import { PageHeading } from './DashboardLayout'
import PreviewPane from './PreviewPane'
import { AddPageButton, PageControls } from './SitePages'

function ProfileCard() {
  const { page, updatePage } = usePage()
  const theme = resolveTheme(page.theme)
  const setTheme = (patch) => updatePage({ theme: { ...page.theme, ...patch } })
  const usesCover = ['hero', 'banner', 'left'].includes(theme.layout)
  return (
    <Card className="p-5 sm:p-7">
      <div className="mt-5 grid gap-5">
        <Input label="Name" maxLength={80} value={page.display_name} onChange={(e) => updatePage({ display_name: e.target.value })} />
        <Input label="Trust line (optional)" maxLength={50} placeholder="2 lakh followers · 40+ brand collabs" value={theme.tagline || ''} onChange={(e) => setTheme({ tagline: e.target.value })} />
        <Textarea label="About" rows={3} maxLength={300} value={page.bio} hint={`${page.bio.length}/300 · Hindi and English both work`} onChange={(e) => updatePage({ bio: e.target.value })} />
        <div className="grid gap-5 lg:grid-cols-3">
          <ImageInput label="Profile photo" round value={page.avatar_url} onChange={(avatar_url) => updatePage({ avatar_url })} folder="avatars" />
          <ImageInput label={usesCover ? 'Cover photo' : 'Cover photo (needs a photo layout)'} value={theme.cover} onChange={(cover) => setTheme({ cover })} folder="covers" />
          <ImageInput
            label="Page background"
            value={theme.bgType === 'image' ? theme.bgImage : ''}
            onChange={(bgImage) => setTheme(bgImage ? { bgType: 'image', bgImage } : { bgType: 'solid', bgImage: '' })}
            folder="backgrounds"
          />
        </div>
      </div>
    </Card>
  )
}

function WhatsappCard() {
  const { page, updatePage } = usePage()
  const wa = page.whatsapp || {}
  const set = (patch) => updatePage({ whatsapp: { ...wa, ...patch } })
  return (
    <Card className="p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white"><WhatsappIcon size={22} /></span>
        <div className="min-w-0 flex-1">
          <Toggle
            label="Open for WhatsApp messages"
            description="Shows a floating WhatsApp button so your audience can message you directly."
            checked={!!wa.open}
            onChange={(open) => set({ open })}
          />
        </div>
      </div>
      {wa.open && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="WhatsApp number" inputMode="tel" placeholder="98765 43210" value={wa.number || ''} onChange={(e) => set({ number: e.target.value })} hint="Indian numbers get +91 automatically" />
          <Input label="Button label (optional)" maxLength={30} placeholder="Chat on WhatsApp" hint="Leave empty to show only the icon" value={wa.label || ''} onChange={(e) => set({ label: e.target.value })} />
          <Textarea className="sm:col-span-2" rows={2} label="Pre-filled message (optional)" maxLength={300} placeholder="Hi! I saw your page…" value={wa.message || ''} onChange={(e) => set({ message: e.target.value })} />
        </div>
      )}
    </Card>
  )
}

function SortableBlock({ block, open, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  return (
    <SectionCard
      block={block}
      open={open}
      onToggle={onToggle}
      rootRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      handle={
        <button type="button" className="grid h-10 w-7 shrink-0 cursor-grab sm:w-10 touch-none place-items-center rounded-xl text-ink-400 hover:bg-cream active:cursor-grabbing" aria-label="Drag to reorder" {...attributes} {...listeners}>
          <GripVertical className="size-5" />
        </button>
      }
    />
  )
}

function AddBlockModal({ open, onClose, onPick, pageName }) {
  const navigate = useNavigate()
  return (
    <Modal open={open} onClose={onClose} title={`What do you want to add to ${pageName}?`} wide>
      <div className="grid gap-5">
        {ADD_GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="mb-2 text-sm font-bold">{g.title}</h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {g.types.map((type) => <AddSectionButton key={type} type={type} onPick={onPick} />)}
              {g.title === 'Earn' && (
                <button type="button" onClick={() => navigate('/dashboard/products', { state: { newProduct: true } })} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-soft">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime"><ShoppingBag className="size-[18px]" /></span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">A product to sell</span>
                    <span className="block truncate text-xs text-ink-500">Download, 1:1 call, webinar, affiliate</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/** A settings group that stays folded until it's needed, so a page's sections stay in view */
function Fold({ title, summary, defaultOpen = false, forceOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{title}</span>
          <span className="block truncate text-xs text-ink-500">{summary}</span>
        </span>
        <ChevronDown className={`size-[18px] shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-ink/5">{children}</div>}
    </div>
  )
}

/** One page of the site: what's on it at a glance, and its sections when open */
function PageGroup({ title, sitePage, blocks, open, onOpen, openId, setOpenId, onAdd, children }) {
  const { reorderBlocks, canEdit } = usePage()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const examples = blocks.filter((b) => b.data?.sample && b.type !== 'products').length
  const summary = blocks.map((b) => BLOCK_TYPES[b.type]?.label).filter(Boolean).join(' · ')

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const ids = blocks.map((b) => b.id)
    reorderBlocks(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)))
  }

  // Closing the page above can move this one off screen: bring its top back
  const root = useRef(null)
  useEffect(() => {
    if (open && root.current?.getBoundingClientRect().top < 64) root.current.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [open])

  return (
    <section ref={root} className={`card scroll-mt-16 overflow-hidden ${open ? 'ring-2 ring-ink' : ''}`} aria-label={title}>
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button type="button" onClick={onOpen} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${open ? 'bg-ink text-white' : 'bg-cream'}`}>
            {sitePage ? <FileText className="size-5" /> : <House className="size-5" />}
          </span>
          <span className="min-w-0">
            <span className="block text-[17px] font-bold">{title}</span>
            <span className="block truncate text-xs text-ink-500">
              {blocks.length ? summary : 'Nothing here yet'}
            </span>
          </span>
        </button>
        {examples > 0 && <span className="hidden shrink-0 rounded-full bg-lilac-100 px-2.5 py-1 text-xs font-semibold sm:inline">{examples} example{examples === 1 ? '' : 's'}</span>}
        {sitePage && <span className="hidden sm:block"><PageControls sitePage={sitePage} /></span>}
        <button type="button" onClick={onOpen} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-cream" aria-label={open ? `Close ${title}` : `Open ${title}`}>
          <ChevronDown className={`size-[18px] transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-ink/5 bg-cream/50 p-3 sm:p-4">
          {sitePage && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-white py-0.5 pr-1 pl-3 sm:hidden">
              <span className="text-xs font-semibold text-ink-500">Menu order and page settings</span>
              <PageControls sitePage={sitePage} />
            </div>
          )}
          {children}
          {blocks.length > 0 && <p className="px-1 text-xs text-ink-500">Shown from top to bottom. Drag the dots to change the order.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2.5">
                {blocks.map((b) => (
                  <SortableBlock key={b.id} block={b} open={openId === b.id} onToggle={() => setOpenId(openId === b.id ? null : b.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {canEdit && (
            <button type="button" onClick={onAdd} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-white text-sm font-semibold text-ink-600 transition hover:border-ink/40 hover:text-ink">
              <Plus className="size-4" /> Add to {title}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/** Tells the creator what a template change did, with an undo when only the look changed */
function AppliedBanner() {
  const location = useLocation()
  const navigate = useNavigate()
  const { page, blocks, updatePage, updateBlock } = usePage()
  const applied = location.state?.applied
  if (!applied) return null
  const dismiss = () => navigate(location.pathname, { replace: true, state: null })
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-lime-200 p-4 text-sm">
      <p className="min-w-0 flex-1 basis-60">
        {applied.mode === 'look' ? (
          <><b>{applied.name} design is on.</b> Your pages and content haven’t moved; they’re restyled.</>
        ) : (
          <><b>{applied.name} is on.</b> Your own content has moved into the pages below. Anything marked Example is only visible to you.</>
        )}
      </p>
      <span className="flex gap-2">
        {applied.previousTheme && page.theme?.template === applied.id && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              updatePage({ theme: applied.previousTheme }, { immediate: true })
              for (const b of applied.previousSections || []) {
                const old = blocks.find((x) => x.id === b.id)
                if (old) updateBlock(b.id, { data: { columns: b.columns ?? old.data.columns, style: b.style ?? old.data.style } })
              }
              dismiss()
            }}
          >
            Undo
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>OK</Button>
      </span>
    </div>
  )
}

export default function Editor() {
  const { blocks, sitePages, addBlock, sitePageId, setSitePageId, page, editTarget, setEditTarget } = usePage()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  // Clicking the open page closes it. Selecting any page, here or in the preview, opens it again
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => setCollapsed(false), [sitePageId])
  const toggle = (id) => {
    if (id === sitePageId) setCollapsed(!collapsed)
    else setSitePageId(id)
  }

  // Tapping Edit in the preview opens that section here, ready to change
  useEffect(() => {
    if (!editTarget) return
    const [target, focusLink] = editTarget.split(':')
    setCollapsed(false)
    if (target === 'profile') {
      setSitePageId(null)
      setProfileOpen(true)
    } else if (target === 'whatsapp') {
      setSitePageId(null)
      setWhatsappOpen(true)
    } else {
      setSitePageId(blocks.find((b) => b.id === target)?.site_page_id ?? null)
      setOpenId(target)
    }
    const domId = target === 'profile' ? 'profile-settings' : target === 'whatsapp' ? 'whatsapp-settings' : `section-${target}`
    const timer = setTimeout(() => {
      const el = document.getElementById(domId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (focusLink) el?.querySelector('input[inputmode="url"]')?.focus({ preventScroll: true })
      setEditTarget(null)
      setProfileOpen(false)
      setWhatsappOpen(false)
    }, 120)
    return () => clearTimeout(timer)
  }, [editTarget, blocks, setEditTarget, setSitePageId])
  const onPage = (id) => blocks.filter((b) => (b.site_page_id ?? null) === id)

  async function pick(type) {
    setAdding(false)
    // The lead form always lives on Home; everything else goes where she chose to add it
    const home = type === 'lead_form'
    const row = await addBlock(type, BLOCK_TYPES[type].defaults, home ? { sitePage: null } : {})
    if (!row) return
    if (home) setSitePageId(null)
    setEditTarget(row.id)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3 pb-20 xl:pb-0">
        <PageHeading title="Your" italic="website.">
          Here is everything on your site. Open a page to change it, and the preview follows. It all saves automatically.
        </PageHeading>

        <AppliedBanner />

        <PageGroup title="Home" blocks={onPage(null)} open={sitePageId === null && !collapsed} onOpen={() => toggle(null)} openId={openId} setOpenId={setOpenId} onAdd={() => setAdding(true)}>
          <span id="profile-settings" className="block scroll-mt-24" />
          <Fold forceOpen={profileOpen} title="Your name, photo and about" summary={page.bio ? `${page.display_name} · ${page.bio}` : 'Add these first: they sit at the top of your site'} defaultOpen={!page.bio || !page.avatar_url}>
            <ProfileCard />
          </Fold>
          <span id="whatsapp-settings" className="block scroll-mt-24" />
          <Fold forceOpen={whatsappOpen} title="WhatsApp button" summary={page.whatsapp?.open ? 'On: visitors can message you' : 'Off'}>
            <WhatsappCard />
          </Fold>
          <p className="px-1 text-sm text-ink-500">
            Social icons under your name are in <Link to="/dashboard/settings" className="font-semibold text-ink underline underline-offset-2">Settings</Link>.
          </p>
        </PageGroup>

        {sitePages.map((s) => (
          <PageGroup key={s.id} title={s.nav_label || s.title} sitePage={s} blocks={onPage(s.id)} open={sitePageId === s.id && !collapsed} onOpen={() => toggle(s.id)} openId={openId} setOpenId={setOpenId} onAdd={() => setAdding(true)} />
        ))}

        <AddPageButton />

      </div>
      <PreviewPane />
      <AddBlockModal open={adding} onClose={() => setAdding(false)} onPick={pick} pageName={sitePages.find((s) => s.id === sitePageId)?.title || 'Home'} />
    </div>
  )
}
