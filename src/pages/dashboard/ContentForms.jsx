import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePage } from '../../context/PageContext'
import { Badge, Button, Card, Modal, Toggle } from '../../components/ui'
import { BLOCK_TYPES, blockIsComplete, blockSummary, CONTENT_GROUPS, CONTENT_TYPES } from './blockTypes'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'
import PreviewPane from './PreviewPane'
import SectionCard, { AddSectionButton } from './SectionCard'

export default function ContentForms() {
  const { blocks, sitePages, setSitePageId, addBlock, updateBlock, removeBlock, autoPage, canEdit } = usePage()
  const [openId, setOpenId] = useState(null)
  const [fresh, setFresh] = useState(null)
  const [view, setView] = useViewMode('content-list')
  const added = blocks.filter((b) => CONTENT_TYPES.includes(b.type))
  const pageName = (b) => (b.site_page_id ? sitePages.find((p) => p.id === b.site_page_id)?.title : '')

  async function pick(type) {
    // The lead form always lives on Home
    const sitePage = type === 'lead_form' ? null : await autoPage('content')
    const row = await addBlock(type, BLOCK_TYPES[type].defaults, { sitePage })
    if (row) {
      setOpenId(row.id)
      if (!row.existed) setFresh(row.id)
      setSitePageId(row.site_page_id ?? null)
    }
  }

  const editing = blocks.find((b) => b.id === openId)

  // Closing a just-added form without filling it in leaves nothing behind
  function closeForm() {
    if (editing && fresh === editing.id && !blockIsComplete(editing)) removeBlock(editing.id)
    setOpenId(null)
    setFresh(null)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4 pb-20 xl:pb-0">
        <PageHeading title="Content" italic="& forms.">
          The lead form goes on Home. Everything else goes on a Content page in your site’s top menu, created automatically. Tap one to fill it in.
        </PageHeading>

        {canEdit && (
          <Card className="grid gap-5 p-5 sm:p-7">
            {CONTENT_GROUPS.map((g) => (
              <div key={g.title}>
                <h2 className="text-sm font-bold">{g.title}</h2>
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {g.types.map((type) => <AddSectionButton key={type} type={type} onPick={pick} />)}
                </div>
              </div>
            ))}
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
          <h2 className="text-lg font-bold">On your website <span className="text-ink-400">({added.length})</span></h2>
          {added.length > 0 && <ViewToggle value={view} onChange={setView} />}
        </div>
        {added.length > 0 && <p className="-mt-2 px-1 text-sm text-ink-500">These are the same sections you see in Website → Pages. Change one here and it changes there too.</p>}
        {added.length === 0 ? (
          <p className="px-1 text-sm text-ink-500">Nothing yet. Tap any option above to add it.</p>
        ) : view === 'table' ? (
          <DataTable
            rows={added}
            minWidth={640}
            onRowClick={(b) => setOpenId(b.id)}
            columns={[
              { key: 'title', label: 'Section', value: (b) => blockSummary(b), className: 'truncate' },
              { key: 'type', label: 'Type', value: (b) => BLOCK_TYPES[b.type]?.label, className: 'whitespace-nowrap text-ink-600' },
              { key: 'page', label: 'Page', value: (b) => pageName(b) || 'Home', className: 'text-ink-600' },
              { key: 'example', label: 'Status', value: (b) => (b.data?.sample ? 'Example' : 'Yours'), render: (b) => (b.data?.sample ? <Badge tone="lilac">Example</Badge> : <Badge tone="green">Yours</Badge>) },
              { key: 'is_active', label: 'Showing', value: (b) => (b.is_active ? 1 : 0), render: (b) => <Toggle checked={b.is_active} disabled={!canEdit} onChange={(v) => updateBlock(b.id, { is_active: v })} /> },
            ]}
          />
        ) : (
          <div className="space-y-2.5">
            {added.map((b) => (
              <SectionCard key={b.id} block={b} note={pageName(b)} open={false} onToggle={() => setOpenId(b.id)} />
            ))}
          </div>
        )}
        <p className="px-1 text-sm text-ink-500">
          Change the order in <Link to="/dashboard/editor" className="font-semibold text-ink underline underline-offset-2">Website</Link>. People who fill a lead form appear in <Link to="/dashboard/leads" className="font-semibold text-ink underline underline-offset-2">Leads</Link>.
        </p>
      </div>
      <PreviewPane />
      <Modal open={Boolean(editing)} onClose={closeForm} title={editing ? BLOCK_TYPES[editing.type]?.label : ''} wide>
        {editing && <SectionCard block={editing} open bare />}
        <div className="mt-4 flex justify-end"><Button onClick={closeForm}>Done</Button></div>
      </Modal>
    </div>
  )
}
