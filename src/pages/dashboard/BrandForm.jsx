import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Plus } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { Button, Empty } from '../../components/ui'
import { BLOCK_TYPES } from './blockTypes'
import { PageHeading } from './DashboardLayout'
import PreviewPane from './PreviewPane'
import SectionCard from './SectionCard'

export default function BrandForm() {
  const { blocks, addBlock, canEdit } = usePage()
  const forms = blocks.filter((b) => b.type === 'enquiry')
  const [openId, setOpenId] = useState(forms[0]?.id ?? null)

  async function add() {
    const row = await addBlock('enquiry', BLOCK_TYPES.enquiry.defaults, { sitePage: null })
    if (row) setOpenId(row.id)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4 pb-20 xl:pb-0">
        <PageHeading title="Brand" italic="form.">
          The form brands use to contact you from your website. Their enquiries appear in <Link to="/dashboard/deals" className="font-semibold text-ink underline underline-offset-2">Collabs</Link>.
        </PageHeading>
        {forms.length === 0 ? (
          <Empty icon={BriefcaseBusiness} title="No brand form yet" action={canEdit && <Button onClick={add}><Plus className="size-4" /> Add to my website</Button>}>
            Brands fill in their name, budget and brief, and it comes straight to you.
          </Empty>
        ) : (
          <div className="space-y-2.5">
            {forms.map((b) => (
              <SectionCard key={b.id} block={b} open={openId === b.id} onToggle={() => setOpenId(openId === b.id ? null : b.id)} />
            ))}
          </div>
        )}
      </div>
      <PreviewPane />
    </div>
  )
}
