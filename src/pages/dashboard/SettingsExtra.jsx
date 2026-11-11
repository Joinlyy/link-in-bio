import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Globe, ShieldCheck } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { errorMessage, invokeFunction, supabase } from '../../lib/supabase'
import { useOwnerFeatures } from '../../lib/usePlan'
import ImageInput from '../../components/ImageInput'
import { Alert, Badge, Button, Card, Input, Textarea, useToast, askConfirm } from '../../components/ui'

export function SeoTrackingCard() {
  const { page, updatePage } = usePage()
  const seo = page.seo || {}
  const tracking = page.tracking || {}
  const ga4Bad = tracking.ga4 && !/^G-[A-Z0-9]{4,16}$/.test(tracking.ga4)
  const pixelBad = tracking.meta_pixel && !/^\d{6,20}$/.test(tracking.meta_pixel)
  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">SEO & sharing</h2>
      <p className="mt-1 text-sm text-ink-500">How your page looks in Google and when shared on WhatsApp or Instagram.</p>
      <div className="mt-5 grid gap-4">
        <Input label="Page title" maxLength={70} placeholder={`${page.display_name || page.username} | Links`} value={seo.title || ''} hint={`${(seo.title || '').length}/70`} onChange={(e) => updatePage({ seo: { ...seo, title: e.target.value } })} />
        <Textarea label="Description" rows={2} maxLength={160} placeholder={page.bio} value={seo.description || ''} hint={`${(seo.description || '').length}/160`} onChange={(e) => updatePage({ seo: { ...seo, description: e.target.value } })} />
        <ImageInput label="Share image (1200×630 works best)" value={seo.image} onChange={(image) => updatePage({ seo: { ...seo, image } })} folder="seo" />
      </div>
      <h3 className="mt-8 font-bold">Tracking pixels</h3>
      <p className="mt-1 text-sm text-ink-500">Loaded only after a visitor accepts cookies on your page.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Google Analytics 4 ID" placeholder="G-XXXXXXXXXX" value={tracking.ga4 || ''} error={ga4Bad ? 'Should look like G-XXXXXXXXXX' : ''} onChange={(e) => updatePage({ tracking: { ...tracking, ga4: e.target.value.trim().toUpperCase() } })} />
        <Input label="Meta Pixel ID" placeholder="123456789012345" inputMode="numeric" value={tracking.meta_pixel || ''} error={pixelBad ? 'Pixel IDs are numbers only' : ''} onChange={(e) => updatePage({ tracking: { ...tracking, meta_pixel: e.target.value.trim() } })} />
      </div>
    </Card>
  )
}

/** TOTP two-factor authentication using Supabase Auth MFA */
export function TwoFactorCard() {
  const toast = useToast()
  const [factor, setFactor] = useState(undefined)
  const [enroll, setEnroll] = useState(null) // { id, qr, secret }
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactor(data?.totp?.find((f) => f.status === 'verified') || null)
  }
  useEffect(() => {
    load()
  }, [])

  async function start() {
    setError('')
    setBusy(true)
    // Clean up abandoned, unverified factors first
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.all || []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${Date.now()}` })
    setBusy(false)
    if (err) return setError(err.message)
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() })
    setBusy(false)
    if (err) return setError('That code didn’t work. Check the time on your phone and try again.')
    setEnroll(null)
    setCode('')
    toast('Two-factor login is on')
    load()
  }

  async function disable() {
    if (!(await askConfirm({ title: 'Turn off two-factor login?', confirmLabel: 'Turn off' }))) return
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    if (err) return toast(err.message, 'error')
    toast('Two-factor login turned off')
    load()
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-5" />
        <h2 className="text-lg font-bold">Two-factor login</h2>
        {factor ? <Badge tone="green">On</Badge> : factor === null ? <Badge>Off</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-ink-500">Ask for a 6-digit code from Google Authenticator, Authy or 1Password when you sign in.</p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {factor ? (
        <Button variant="dangerSoft" size="sm" className="mt-5" onClick={disable}>Turn off</Button>
      ) : enroll ? (
        <form onSubmit={verify} className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
          <img src={enroll.qr} alt="Scan with your authenticator app" className="size-40 rounded-2xl bg-white p-2 ring-1 ring-ink/10" />
          <div className="grid gap-3">
            <p className="text-sm text-ink-600">Scan the QR code, or enter this key: <code className="rounded bg-cream px-1.5 py-0.5 text-xs break-all">{enroll.secret}</code></p>
            <Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={busy} disabled={code.length !== 6}>Verify & turn on</Button>
              <Button variant="ghost" size="sm" onClick={() => setEnroll(null)}>Cancel</Button>
            </div>
          </div>
        </form>
      ) : (
        <Button size="sm" className="mt-5" loading={busy} onClick={start}>Set up</Button>
      )}
    </Card>
  )
}

const DNS_TARGET = import.meta.env.VITE_CUSTOM_DOMAIN_TARGET || 'cname.vercel-dns.com'

function DnsRow({ type, name, value }) {
  const toast = useToast()
  return (
    <div className="grid gap-1 rounded-2xl bg-cream p-3 text-sm sm:grid-cols-[70px_1fr_1.4fr] sm:items-center sm:gap-3">
      <span className="font-bold">{type}</span>
      <code className="truncate">{name}</code>
      <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => toast('Copied'))} className="flex min-w-0 items-center gap-2 text-left">
        <code className="min-w-0 truncate">{value}</code>
        <Copy className="size-3.5 shrink-0 text-ink-400" />
      </button>
    </div>
  )
}

/** Connect a creator-owned domain (Pro). Verified via DNS, activated by the super admin. */
export function CustomDomainCard() {
  const { page, updatePage, canEdit, reload } = usePage()
  const features = useOwnerFeatures(page.owner_id)
  const toast = useToast()
  const [domain, setDomain] = useState(page.custom_domain || '')
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null)
  const allowed = features?.custom_domain
  const status = page.domain_status

  async function save() {
    setBusy('save')
    const { data, error } = await supabase.from('pages').update({ custom_domain: domain.trim() || null }).eq('id', page.id).select().single()
    setBusy('')
    if (error) return toast(errorMessage(error), 'error')
    updatePage({ custom_domain: data.custom_domain, domain_status: data.domain_status, domain_token: data.domain_token }, { immediate: false })
    setResult(null)
    toast(data.custom_domain ? 'Domain saved — add the DNS records below' : 'Domain removed')
  }

  async function verify() {
    setBusy('verify')
    try {
      const res = await invokeFunction('domains', { action: 'verify', page_id: page.id })
      setResult(res)
      if (res.ok) {
        toast('Domain verified!')
        reload()
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="size-5" />
        <h2 className="text-lg font-bold">Custom domain</h2>
        {status === 'active' && <Badge tone="green">Live</Badge>}
        {status === 'verified' && <Badge tone="lilac">Verified · going live soon</Badge>}
        {status === 'pending' && <Badge>Waiting for DNS</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-500">Use your own address like <b>links.yourname.com</b> for this page and all its sub-pages.</p>
      {features && !allowed ? (
        <div className="mt-4"><Alert tone="info">Custom domains are part of Pro. <Link to="/dashboard/billing" className="font-semibold underline">See plans</Link></Alert></div>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input className="field" placeholder="links.yourname.com" value={domain} disabled={!canEdit} onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/^https?:\/\//, '').split('/')[0])} />
            <Button onClick={save} loading={busy === 'save'} disabled={!canEdit || domain === (page.custom_domain || '')}>Save</Button>
          </div>
          {page.custom_domain && status !== 'active' && (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-semibold">Add these records at your domain provider (GoDaddy, Hostinger, Namecheap…):</p>
              <DnsRow type="CNAME" name={page.custom_domain} value={DNS_TARGET} />
              <DnsRow type="TXT" name={`_linkinbio.${page.custom_domain}`} value={page.domain_token || '…'} />
              <p className="text-xs text-ink-500">DNS changes can take up to a few hours. Then click Verify. After verification our team switches it on (usually within a day).</p>
              <Button variant="outline" size="sm" loading={busy === 'verify'} onClick={verify} disabled={!canEdit || status === 'verified'}>
                {status === 'verified' ? 'Verified' : 'Verify DNS'}
              </Button>
              {result && !result.ok && <Alert>{result.message || 'Records not found yet.'}</Alert>}
            </div>
          )}
          {status === 'active' && (
            <p className="mt-4 text-sm">Your page is live at <a className="font-semibold underline" href={`https://${page.custom_domain}`} target="_blank" rel="noreferrer">{page.custom_domain}</a>.</p>
          )}
        </>
      )}
    </Card>
  )
}
