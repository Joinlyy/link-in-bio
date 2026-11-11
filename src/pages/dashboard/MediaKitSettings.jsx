import { useState } from 'react'
import { Download, ExternalLink, X } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import MediaKitView from '../../components/MediaKitView'
import { Alert, Button, Card, Input, Textarea, Toggle } from '../../components/ui'
import { pageUrl, INSTAGRAM_ENABLED } from '../../lib/config'
import { PageHeading } from './DashboardLayout'

function RateCardEditor({ rates, onChange }) {
  const update = (i, patch) => onChange(rates.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-700">Rate card</p>
      <div className="grid gap-2">
        {rates.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input className="field h-10 flex-1 text-sm" placeholder="1 Reel" maxLength={40} value={r.format} onChange={(e) => update(i, { format: e.target.value })} />
            <input className="field h-10 w-28 text-sm" placeholder="₹ 15,000" maxLength={20} value={r.price} onChange={(e) => update(i, { price: e.target.value })} />
            <button type="button" onClick={() => onChange(rates.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center rounded-full bg-cream" aria-label="Remove rate"><X className="size-4" /></button>
          </div>
        ))}
      </div>
      {rates.length < 10 && (
        <button type="button" onClick={() => onChange([...rates, { format: '', price: '' }])} className="mt-2 text-sm font-semibold underline underline-offset-4">+ Add a rate</button>
      )}
      <p className="mt-1.5 text-xs text-ink-500">Leave price empty to show “On request”. Include barter options too.</p>
    </div>
  )
}

const SUGGESTED = ['Reels', 'Stories', 'Static posts', 'YouTube integration', 'Barter', 'Event appearance', 'UGC videos']

export default function MediaKitSettings() {
  const { page, instagram, updatePage } = usePage()
  const kit = page.media_kit || { enabled: true }
  const setKit = (patch) => updatePage({ media_kit: { ...kit, ...patch } })
  const [service, setService] = useState('')
  const services = kit.services || []
  const url = `${pageUrl(page.username)}/media-kit`

  function addService(s) {
    const v = s.trim()
    if (!v || services.includes(v) || services.length >= 12) return
    setKit({ services: [...services, v] })
    setService('')
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Media kit."
        italic="Pitch-ready."
        actions={
          <>
            <Button variant="outline" size="sm" href={url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open</Button>
            <Button size="sm" href={`${url}?print=1`} target="_blank" rel="noreferrer"><Download className="size-4" /> Download PDF</Button>
          </>
        }
      >
        Built from your page and Instagram data. Share the link with brands or save it as a PDF.
      </PageHeading>

      {!page.is_published && <Alert tone="info">Publish your page to make the media kit link work for brands.</Alert>}

      <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card className="h-fit space-y-5 p-5 sm:p-7 xl:sticky xl:top-28">
          <Toggle label="Public media kit" description={url.replace(/^https?:\/\//, '')} checked={kit.enabled !== false} onChange={(enabled) => setKit({ enabled })} />
          <Textarea label="Headline" rows={2} maxLength={200} placeholder="Delhi-based food creator making easy Indian recipes for working professionals." value={kit.headline || ''} onChange={(e) => setKit({ headline: e.target.value })} />
          <Textarea label="About & audience" rows={4} maxLength={1200} placeholder="My audience is mostly 18–34, metro cities…" value={kit.about || ''} onChange={(e) => setKit({ about: e.target.value })} />
          <Input label="Business email" type="email" placeholder="collabs@you.com" value={kit.contact_email || ''} onChange={(e) => setKit({ contact_email: e.target.value.trim() })} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-700">Collaboration formats</p>
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-ink py-1 pr-1.5 pl-3 text-xs font-semibold text-white">
                  {s}
                  <button type="button" onClick={() => setKit({ services: services.filter((x) => x !== s) })} className="grid size-5 place-items-center rounded-full hover:bg-white/20" aria-label={`Remove ${s}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addService(service) }}>
              <input className="field h-10 text-sm" placeholder="Add a format" value={service} maxLength={40} onChange={(e) => setService(e.target.value)} />
              <Button type="submit" size="sm" variant="soft">Add</Button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED.filter((s) => !services.includes(s)).map((s) => (
                <button key={s} type="button" onClick={() => addService(s)} className="rounded-full border border-ink/10 px-3 py-1 text-xs font-medium hover:border-ink/30">+ {s}</button>
              ))}
            </div>
          </div>
          <RateCardEditor rates={kit.rates || []} onChange={(rates) => setKit({ rates })} />
          {!instagram && INSTAGRAM_ENABLED && <Alert tone="info">Connect Instagram in Settings to add followers, engagement and recent posts.</Alert>}
        </Card>
        <div className="min-w-0 rounded-3xl bg-cream-200 p-3 sm:p-5">
          <MediaKitView page={page} instagram={instagram} />
        </div>
      </div>
    </div>
  )
}
