import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2 } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { pageDisplayUrl } from '../../lib/config'
import { Button, InfoButton, Input, Modal, Toggle, useToast, askConfirm } from '../../components/ui'

const slugify = (v) => v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const RESERVED = ['p', 'media-kit', 'order', 'home']

function SitePageModal({ value, onClose }) {
  const { page, sitePages, setSitePages, setSitePageId, reload } = usePage()
  const toast = useToast()
  const [form, setForm] = useState(value)
  const [slugTouched, setSlugTouched] = useState(Boolean(value.id))
  const [busy, setBusy] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const slugError = !/^[a-z0-9][a-z0-9-]{0,39}$/.test(form.slug || '') ? 'Use letters, numbers and dashes' : RESERVED.includes(form.slug) ? 'That address is reserved' : ''

  async function save() {
    setBusy(true)
    const payload = {
      title: form.title.trim(), slug: form.slug, nav_label: form.nav_label?.trim() || null, visibility: form.visibility,
      show_in_nav: form.show_in_nav, is_published: form.is_published, lead_popup: Boolean(form.lead_popup), seo: form.seo || {},
    }
    const q = form.id
      ? supabase.from('site_pages').update(payload).eq('id', form.id)
      : supabase.from('site_pages').insert({ ...payload, page_id: page.id, position: sitePages.length })
    const { data, error } = await q.select().single()
    setBusy(false)
    if (error) return toast(/site_pages_page_id_slug_key/.test(error.message) ? 'You already have a page at that address' : errorMessage(error), 'error')
    setSitePages((list) => (form.id ? list.map((x) => (x.id === data.id ? data : x)) : [...list, data]))
    setSitePageId(data.id)
    toast(form.id ? 'Page saved' : 'Page created — add blocks to it below')
    onClose()
  }

  async function remove() {
    if (!(await askConfirm({ title: `Delete “${form.title}”?`, message: 'All its sections are deleted too.', confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('site_pages').delete().eq('id', form.id)
    if (error) return toast(errorMessage(error), 'error')
    setSitePageId(null)
    onClose()
    reload()
  }

  return (
    <Modal open onClose={onClose} title={form.id ? 'Page settings' : 'Add a page'}>
      <div className="grid gap-4">
        <Input
          label="Page title"
          maxLength={80}
          placeholder="About me"
          value={form.title}
          onChange={(e) => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
        />
        <div>
          <span className="mb-1.5 flex items-center gap-1"><label className="block text-sm font-medium text-ink-700" htmlFor="sp-slug">Address</label> <InfoButton label="Page address" /></span>
          <div className="flex items-center rounded-2xl border border-ink/10 bg-cream pl-4 focus-within:border-lilac focus-within:bg-white">
            <span className="shrink-0 text-sm text-ink-500">{pageDisplayUrl(page.username)}/</span>
            <input id="sp-slug" className="h-12 min-w-0 flex-1 bg-transparent pr-4 text-sm font-semibold outline-none" value={form.slug} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }) }} />
          </div>
          {form.slug && slugError && <p className="mt-1.5 text-xs font-medium text-red-600">{slugError}</p>}
        </div>
        <Input label="Menu label (optional)" maxLength={30} placeholder={form.title || 'About'} value={form.nav_label || ''} onChange={(e) => set({ nav_label: e.target.value })} />
        <Toggle label="Open the lead form popup after 10 seconds" description="Your Home lead form appears once for visitors on this page" checked={Boolean(form.lead_popup)} onChange={(lead_popup) => set({ lead_popup })} />
        <Toggle label="Show in menu" description="A tab at the top of your page" checked={form.show_in_nav} onChange={(show_in_nav) => set({ show_in_nav })} />
        <Toggle label="Published" description="Turn off to work on it privately" checked={form.is_published} onChange={(is_published) => set({ is_published })} />
      </div>
      <div className="mt-6 flex items-center justify-between gap-2">
        {form.id ? <Button variant="dangerSoft" size="sm" onClick={remove}><Trash2 className="size-4" /> Delete</Button> : <span />}
        <Button onClick={save} loading={busy} disabled={!form.title.trim() || Boolean(slugError)}>{form.id ? 'Save' : 'Create page'}</Button>
      </div>
    </Modal>
  )
}

/** Tabs for Home + sub-pages of a multi-page site */
/** Move a page along the menu, or open its settings */
export function PageControls({ sitePage }) {
  const { sitePages, setSitePages, canEdit } = usePage()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  async function move(dir) {
    const i = sitePages.findIndex((s) => s.id === sitePage.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sitePages.length) return
    const next = [...sitePages]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSitePages(next.map((s, k) => ({ ...s, position: k })))
    const results = await Promise.all(next.map((s, k) => supabase.from('site_pages').update({ position: k }).eq('id', s.id)))
    if (results.some((r) => r.error)) toast('Could not reorder pages', 'error')
  }

  if (!canEdit) return null
  return (
    <span className="flex shrink-0 gap-1">
      <button type="button" onClick={() => move(-1)} className="grid size-9 place-items-center rounded-full hover:bg-cream" aria-label={`Move ${sitePage.title} earlier in the menu`}><ArrowUp className="size-4" /></button>
      <button type="button" onClick={() => move(1)} className="grid size-9 place-items-center rounded-full hover:bg-cream" aria-label={`Move ${sitePage.title} later in the menu`}><ArrowDown className="size-4" /></button>
      <button type="button" onClick={() => setEditing(true)} className="grid size-9 place-items-center rounded-full hover:bg-cream" aria-label={`Settings for ${sitePage.title}`}><Settings2 className="size-4" /></button>
      {editing && <SitePageModal value={sitePage} onClose={() => setEditing(false)} />}
    </span>
  )
}

export function AddPageButton() {
  const { canEdit } = usePage()
  const [editing, setEditing] = useState(false)
  if (!canEdit) return null
  return (
    <>
      <button type="button" onClick={() => setEditing(true)} className="flex h-14 w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink/15 text-sm font-semibold text-ink-600 transition hover:border-ink/40 hover:text-ink">
        <Plus className="size-4" /> Add a page to your menu
      </button>
      {editing && <SitePageModal value={{ title: '', slug: '', nav_label: '', visibility: 'public', show_in_nav: true, is_published: true }} onClose={() => setEditing(false)} />}
    </>
  )
}
