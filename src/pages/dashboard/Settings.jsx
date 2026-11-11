import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, RefreshCw, Trash2, Unplug } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, invokeFunction, supabase } from '../../lib/supabase'
import { disconnectInstagram, startInstagramConnect, syncInstagram } from '../../lib/instagram'
import { INSTAGRAM_ENABLED, PUBLIC_DOMAIN } from '../../lib/config'
import { formatNumber } from '../../lib/embeds'
import { LANGUAGES, NICHES } from '../../lib/i18n'
import { Alert, Badge, Button, Card, InfoButton, Input, Modal, PasswordInput, Select, useToast, askConfirm } from '../../components/ui'
import { savePassword as storePassword, validatePasswords } from '../../components/SetPassword'
import { InstagramIcon, SOCIAL_ICONS } from '../../components/icons'
import { MAIN_SOCIALS, SOCIALS } from '../../lib/socials'
import { PageHeading } from './DashboardLayout'
import { useUsernameCheck } from '../../lib/useUsernameCheck'
import { CustomDomainCard, SeoTrackingCard, TwoFactorCard } from './SettingsExtra'

const UPI_RE = /^[a-zA-Z0-9._-]{2,255}@[a-zA-Z0-9]{2,64}$/

/** The creator's own UPI ID: buyers pay it directly, and the creator confirms each payment */
function PaymentsCard() {
  const { page, updatePage, canEdit } = usePage()
  const toast = useToast()
  const [upi, setUpi] = useState(page.upi_id || '')
  const [name, setName] = useState(page.upi_name || page.display_name || '')
  const clean = upi.trim()
  const wrong = clean && !UPI_RE.test(clean)
  const changed = clean !== (page.upi_id || '') || name.trim() !== (page.upi_name || '')

  function save() {
    updatePage({ upi_id: clean || null, upi_name: name.trim() || null }, { immediate: true })
    toast(clean ? 'Buyers will now pay your UPI ID directly' : 'UPI payments turned off')
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Get paid by UPI</h2>
        {page.upi_id ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Buyers pay your UPI ID straight from GPay, PhonePe or Paytm, with no fees. They send you the payment reference, and you confirm it in Sales after checking your bank app. Their access opens when you confirm.
      </p>
      <div className="mt-5 grid gap-4">
        <Input label="Your UPI ID" placeholder="yourname@okhdfcbank" value={upi} disabled={!canEdit} error={wrong ? 'A UPI ID looks like name@bank, for example priya@okaxis' : undefined} onChange={(e) => setUpi(e.target.value)} />
        <Input label="Name shown when paying" maxLength={80} placeholder="As it appears in your bank" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
      </div>
      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={save} disabled={!changed || wrong}>Save</Button>
          {page.upi_id && <Button variant="ghost" onClick={() => { setUpi(''); updatePage({ upi_id: null }, { immediate: true }); toast('UPI payments turned off') }}>Turn off</Button>}
        </div>
      )}
    </Card>
  )
}

function InstagramCard() {
  const { instagram, setInstagram, isOwner } = usePage()
  const toast = useToast()
  const [busy, setBusy] = useState('')

  async function run(kind, fn) {
    setBusy(kind)
    try {
      await fn()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white">
          <InstagramIcon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">Instagram</h2>
            {instagram ? <Badge tone="green">Connected</Badge> : <Badge>Not connected</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Uses Meta’s official Instagram API. Requires a Creator or Business account. We only read your profile, posts and permitted insights.
          </p>
        </div>
      </div>

      {!isOwner ? (
        <p className="mt-5 rounded-2xl bg-cream p-4 text-sm text-ink-600">
          {instagram ? `Connected as @${instagram.username}. ` : ''}Only the page owner can connect or change Instagram.
        </p>
      ) : instagram ? (
        <>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-cream p-3">
            {instagram.profile_picture_url && <img src={instagram.profile_picture_url} alt="" className="size-11 rounded-full object-cover" referrerPolicy="no-referrer" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">@{instagram.username}</p>
              <p className="text-xs text-ink-500">
                {formatNumber(instagram.followers_count)} followers · synced {new Date(instagram.last_synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" loading={busy === 'sync'} onClick={() => run('sync', async () => { setInstagram(await syncInstagram()); toast('Instagram data refreshed') })}>
              {busy !== 'sync' && <RefreshCw className="size-4" />} Sync now
            </Button>
            <Button
              variant="dangerSoft"
              size="sm"
              loading={busy === 'disconnect'}
              onClick={async () => (await askConfirm({ title: 'Disconnect Instagram?', message: 'Your media kit stats will be removed.', confirmLabel: 'Disconnect' })) && run('disconnect', async () => { await disconnectInstagram(); setInstagram(null); toast('Instagram disconnected') })}
            >
              {busy !== 'disconnect' && <Unplug className="size-4" />} Disconnect
            </Button>
          </div>
        </>
      ) : (
        <Button className="mt-5" loading={busy === 'connect'} onClick={() => run('connect', () => startInstagramConnect({ returnTo: '/dashboard/settings', importProfile: true }))}>
          <InstagramIcon size={16} /> Connect Instagram
        </Button>
      )}
    </Card>
  )
}

function PageSettingsCard() {
  const { page, updatePage } = usePage()
  const toast = useToast()
  const [username, setUsername] = useState(page.username)
  const check = useUsernameCheck(username, page.username)
  const [saving, setSaving] = useState(false)

  async function saveUsername() {
    setSaving(true)
    const { error } = await supabase.from('pages').update({ username }).eq('id', page.id)
    setSaving(false)
    if (error) return toast(errorMessage(error), 'error')
    updatePage({ username })
    toast('Username updated — remember to update your bio link')
  }

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Page</h2>
      <div className="mt-5 grid gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700" htmlFor="username">Username</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center rounded-2xl border border-ink/10 bg-cream pl-4 focus-within:border-lilac focus-within:bg-white">
              <span className="text-[15px] text-ink-500">{PUBLIC_DOMAIN}/</span>
              <input id="username" className="h-12 min-w-0 flex-1 bg-transparent pr-4 text-[15px] font-semibold outline-none" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30))} />
            </div>
            <Button onClick={saveUsername} loading={saving} disabled={username === page.username || check.status !== 'ok'}>Save</Button>
          </div>
          {username !== page.username && <p className={`mt-1.5 text-xs font-medium ${check.status === 'ok' ? 'text-teal' : 'text-ink-500'}`}>{check.message}</p>}
          <p className="mt-1.5 text-xs text-ink-500">Changing it breaks old links and QR codes.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Niche" value={page.niche || ''} onChange={(e) => updatePage({ niche: e.target.value })} options={[{ value: '', label: 'Choose…' }, ...NICHES.map((n) => ({ value: n, label: n }))]} />
          <Select label="Page language" value={page.language} onChange={(e) => updatePage({ language: e.target.value })} options={LANGUAGES} />
        </div>
      </div>
    </Card>
  )
}

function AccountCard() {
  const { profile, user, refreshProfile } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(profile?.full_name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function saveName() {
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
    if (error) return toast(errorMessage(error), 'error')
    refreshProfile()
    toast('Name updated')
  }
  async function savePassword() {
    const problem = validatePasswords(password, confirmPassword)
    if (problem) return toast(problem, 'error')
    try {
      await storePassword(password)
    } catch (err) {
      return toast(err.message, 'error')
    }
    setPassword('')
    setConfirmPassword('')
    toast('Password saved')
  }

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Account</h2>
      <div className="mt-5 grid gap-4">
        <Input label="Email" value={user.email} disabled hint={user.app_metadata?.provider === 'google' ? 'Signed in with Google' : undefined} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input className="flex-1" label="Full name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button variant="soft" onClick={saveName} disabled={name === (profile?.full_name || '')}>Save</Button>
        </div>
        <PasswordInput label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <PasswordInput label="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        <Button variant="soft" className="w-fit" onClick={savePassword} disabled={!password}>Save password</Button>
      </div>
    </Card>
  )
}

function PrivacyCard() {
  const { page, blocks, instagram } = usePage()
  const { profile, signOut } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function exportData() {
    const { data: leads } = await supabase.from('leads').select('*').eq('page_id', page.id).limit(10000)
    const { data: daily } = await supabase.from('page_daily').select('*').eq('page_id', page.id)
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile, page, blocks, instagram, leads, analytics_daily: daily }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${page.username}-data-export.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await invokeFunction('account', { action: 'delete' })
      await signOut()
      window.location.assign('/')
    } catch (err) {
      toast(err.message, 'error')
      setDeleting(false)
    }
  }

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-lg font-bold">Your data</h2>
      <p className="mt-1 text-sm text-ink-500">Download everything we store about you, or permanently delete your account (DPDP Act rights).</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportData}><Download className="size-4" /> Export my data</Button>
        <Button variant="dangerSoft" size="sm" onClick={() => setOpen(true)}><Trash2 className="size-4" /> Delete account</Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <Alert>This permanently deletes your page, blocks, leads, analytics and Instagram connection. It can’t be undone.</Alert>
        <Input className="mt-4" label={`Type ${page.username} to confirm`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={deleting} disabled={confirmText !== page.username} onClick={deleteAccount}>Delete forever</Button>
        </div>
      </Modal>
    </Card>
  )
}

function SocialLinksCard() {
  const { page, updatePage } = usePage()
  const [expanded, setExpanded] = useState(false)
  const socials = page.socials || {}
  const list = expanded ? SOCIALS : SOCIALS.filter((s, i) => i < MAIN_SOCIALS || socials[s.key])
  return (
    <Card className="p-5 sm:p-7">
      <h2 className="flex items-center gap-1 text-lg font-bold">Social links <InfoButton label="Social icons" /></h2>
      <p className="mt-1 text-sm text-ink-500">Each one you fill in shows as an icon under your name on your site. Paste a username or a full link.</p>
      <div className="mt-5 grid gap-3">
        {list.map((s) => {
          const Icon = SOCIAL_ICONS[s.key]
          return (
            <label key={s.key} className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-cream py-1 pr-1 pl-3 focus-within:border-lilac focus-within:bg-white">
              <Icon size={18} className="shrink-0" />
              <span className="sr-only">{s.label}</span>
              <input
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
                placeholder={`${s.label} ${s.placeholder}`}
                value={socials[s.key] || ''}
                maxLength={200}
                onChange={(e) => {
                  const value = e.target.value.trim()
                  updatePage((p) => ({ socials: { ...p.socials, [s.key]: value } }))
                }}
              />
            </label>
          )
        })}
      </div>
      {!expanded && list.length < SOCIALS.length && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-3 text-sm font-semibold underline underline-offset-4">
          Show all platforms
        </button>
      )}
    </Card>
  )
}

export default function Settings() {
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const { reload } = usePage()

  useEffect(() => {
    if (params.get('instagram') === 'connected') {
      toast('Instagram connected!')
      reload()
      setParams({}, { replace: true })
    }
  }, [params, setParams, toast, reload])

  return (
    <div className="space-y-4">
      <PageHeading title="Settings." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <SocialLinksCard />
          <PaymentsCard />
          {INSTAGRAM_ENABLED && <InstagramCard />}
          <PageSettingsCard />
          <CustomDomainCard />
          <SeoTrackingCard />
        </div>
        <div className="space-y-4">
          <AccountCard />
          <TwoFactorCard />
          <PrivacyCard />
        </div>
      </div>
    </div>
  )
}
