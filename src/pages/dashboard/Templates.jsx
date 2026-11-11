import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePage } from '../../context/PageContext'
import TemplatePicker from '../../components/TemplatePicker'
import { Alert, Button, Modal, Toggle, useToast } from '../../components/ui'
import { applyLook, applyTemplate } from '../../lib/applyTemplate'
import { errorMessage } from '../../lib/supabase'
import { PageHeading } from './DashboardLayout'

function ChangeOption({ checked, onSelect, title, children, recommended }) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onSelect} className={`block w-full rounded-2xl border-2 p-4 text-left transition ${checked ? 'border-ink bg-cream' : 'border-ink/10 hover:border-ink/30'}`}>
      <span className="flex flex-wrap items-center gap-2 font-bold">
        {title}
        {recommended && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold">Recommended</span>}
      </span>
      <span className="mt-1 block text-sm leading-relaxed text-ink-600">{children}</span>
    </button>
  )
}

export default function Templates() {
  const { page, blocks, products, sitePages, reload, canEdit, flushPage } = usePage()
  const content = useMemo(() => ({ blocks, sitePages, products: products.filter((p) => p.is_published && p.show_on_page !== false) }), [blocks, sitePages, products])
  const navigate = useNavigate()
  const toast = useToast()
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [leadPopup, setLeadPopup] = useState(false)
  const hasOwnContent = blocks.some((b) => !b.data?.sample && b.type !== 'products')
  const [mode, setMode] = useState(hasOwnContent ? 'look' : 'pages')

  function start(template) {
    if (!canEdit) return
    if (!blocks.length) return apply(template, 'pages')
    setMode(hasOwnContent ? 'look' : 'pages')
    setConfirm(template)
  }

  async function apply(template, how) {
    setBusy(true)
    try {
      await flushPage()
      const previous = how === 'look' ? await applyLook(page, template) : null
      if (how !== 'look') await applyTemplate(page, template, { leadPopup })
      await reload()
      navigate('/dashboard/editor', { state: { applied: { id: template.id, name: template.name, mode: how, previousTheme: previous?.theme, previousSections: previous?.sections } } })
    } catch (err) {
      toast(errorMessage(err), 'error')
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Templates." italic="Pick one, make it yours.">
        Tap any design to see your own site in it. Each one has its own header, fonts, buttons and section layout. Switching never moves or deletes your content.
      </PageHeading>
      {!canEdit && <Alert tone="info">You have view-only access, so templates can’t be applied to this page.</Alert>}
      <TemplatePicker page={page} content={content} busy={busy} onUse={start} />
      <Modal open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} title={`What should ${confirm?.name} change?`}>
        <div className="grid gap-2.5" role="radiogroup" aria-label="What to change">
          <ChangeOption checked={mode === 'look'} onSelect={() => setMode('look')} title="Only the design" recommended={hasOwnContent}>
            Header, fonts, buttons, colours and how your products and cards are laid out all change. Your pages, sections and their order stay exactly as they are. You can undo this.
          </ChangeOption>
          <ChangeOption checked={mode === 'pages'} onSelect={() => setMode('pages')} title="The look and the pages" recommended={!hasOwnContent}>
            Your site is rearranged into this template’s pages, and the order changes. Your own content stays, examples are added for what’s missing, and pages you made are merged in. This can’t be undone.
          </ChangeOption>
        </div>
        {mode === 'pages' && (
          <div className="mt-4 rounded-2xl bg-cream p-4">
            <Toggle label="Open the lead form popup after 10 seconds" description="Shows your Home lead form to visitors once per visit" checked={leadPopup} onChange={setLeadPopup} />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button>
          <Button loading={busy} onClick={() => apply(confirm, mode)}>{mode === 'look' ? 'Change the design' : 'Change design and pages'}</Button>
        </div>
      </Modal>
    </div>
  )
}
