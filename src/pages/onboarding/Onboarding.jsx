import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { startInstagramConnect } from '../../lib/instagram'
import { INSTAGRAM_ENABLED, PUBLIC_DOMAIN } from '../../lib/config'
import { LANGUAGES, NICHES } from '../../lib/i18n'
import { cleanUsername, useUsernameCheck } from '../../lib/useUsernameCheck'
import { Alert, Button, FullScreenLoader, Toggle } from '../../components/ui'
import { Brand } from '../../components/SiteChrome'
import { InstagramIcon } from '../../components/icons'
import TemplatePicker from '../../components/TemplatePicker'
import { applyTemplate } from '../../lib/applyTemplate'

// Template preselected for each niche
const NICHE_TEMPLATE = {
  Fashion: 'vogue-edit', Beauty: 'rose-glow', Fitness: 'iron-mode', Food: 'kitchen-stories', Travel: 'wanderlust',
  Education: 'study-room', Finance: 'money-smart', Tech: 'dev-terminal', Comedy: 'laugh-track', Music: 'stage-lights',
  Dance: 'dance-studio', Gaming: 'player-one', Lifestyle: 'bento', Parenting: 'maa-ki-diary', Spirituality: 'shanti', Business: 'coach-pro',
}

function Steps({ step }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`h-2 rounded-full transition-all ${n === step ? 'w-10 bg-ink' : n < step ? 'w-5 bg-ink' : 'w-5 bg-cream-300'}`} />
      ))}
    </div>
  )
}

export default function Onboarding() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [niche, setNiche] = useState('')
  const [language, setLanguage] = useState('en')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [leadPopup, setLeadPopup] = useState(false)
  const [createdId, setCreatedId] = useState(null)
  const check = useUsernameCheck(username)

  // Already onboarded? Go to the dashboard — unless they're creating an additional page.
  const addingPage = new URLSearchParams(window.location.search).get('new') === '1'
  useEffect(() => {
    supabase.from('pages').select('id').eq('owner_id', user.id).limit(1).then(({ data }) => {
      if (data?.length && !addingPage) navigate('/dashboard', { replace: true })
      else {
        const wanted = sessionStorage.getItem('lib_wanted_username')
        setUsername(cleanUsername(wanted || user.email?.split('@')[0] || ''))
        setChecking(false)
      }
    })
  }, [user, navigate, addingPage])

  async function createPage(template) {
    setBusy(true)
    setError('')
    const { data: page, error: err } = await supabase
      .from('pages')
      .insert({
        owner_id: user.id,
        username,
        display_name: (profile?.full_name || user.user_metadata?.full_name || '').slice(0, 80),
        niche: niche || null,
        language,
        theme: { preset: 'cream' },
      })
      .select()
      .single()
    if (err) {
      setBusy(false)
      setError(errorMessage(err))
      setStep(1)
      return
    }
    try {
      await applyTemplate(page, template, { leadPopup })
    } catch (e) {
      setBusy(false)
      setError(errorMessage(e))
      return
    }
    sessionStorage.removeItem('lib_wanted_username')
    setCreatedId(page.id)
    try {
      localStorage.setItem('lib_page', page.id) // open the new page in the dashboard
    } catch {
      /* ignore */
    }
    setBusy(false)
    setStep(3)
  }

  async function goLive() {
    setBusy(true)
    const { error: err } = await supabase.from('pages').update({ is_published: true }).eq('id', createdId)
    setBusy(false)
    if (err) return setError(errorMessage(err))
    navigate('/dashboard/editor', { replace: true })
  }

  async function connectInstagram() {
    setBusy(true)
    try {
      await startInstagramConnect({ returnTo: '/dashboard/editor', importProfile: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (checking) return <FullScreenLoader />

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex items-center justify-between py-5">
        <Brand />
        <Steps step={step} />
      </header>
      {step === 2 ? (
        <main className="mx-auto w-full max-w-[1440px] flex-1 animate-fade-up px-4 pb-10 sm:px-6">
          <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink">
            <ArrowLeft className="size-4" /> Back
          </button>
          <h1 className="display-lg mt-3">
            Pick a page.
            <span className="display-italic"> Edit anything later.</span>
          </h1>
          <p className="mt-2 mb-5 text-ink-500">Tap a design to see it on the phone. Examples show what you could add, and visitors only see what you add yourself.</p>
          {error && <div className="mb-4"><Alert>{error}</Alert></div>}
          <div className="mb-5 rounded-2xl bg-white p-4 shadow-soft">
            <Toggle label="Open my lead form as a popup after 10 seconds" description="Your lead form is always on Home. This also shows it to visitors once per visit." checked={leadPopup} onChange={setLeadPopup} />
          </div>
          <TemplatePicker
            page={{ username, display_name: profile?.full_name || user.user_metadata?.full_name || '' }}
            initialId={NICHE_TEMPLATE[niche]}
            busy={busy}
            useLabel="Create my page"
            onUse={createPage}
          />
        </main>
      ) : (
      <main className="container-page flex flex-1 items-start justify-center pb-10 sm:items-center">
        <div className="card w-full max-w-2xl animate-fade-up p-6 sm:p-12" key={step}>
          {step === 1 && (
            <>
              <span className="inline-flex rounded-full bg-lilac-100 px-3.5 py-1.5 text-[13px] font-semibold">Step 1 of 3</span>
              <h1 className="display-lg mt-5">
                Claim your
                <br />
                <span className="display-italic">username.</span>
              </h1>
              <div className="mt-8">
                <div className={`flex items-center rounded-2xl border-2 bg-cream pl-4 transition ${check.status === 'ok' ? 'border-teal/40' : check.status === 'taken' || check.status === 'invalid' ? 'border-red-300' : 'border-transparent'}`}>
                  <span className="text-[16px] text-ink-500 sm:text-lg">{PUBLIC_DOMAIN}/</span>
                  <input autoFocus aria-label="Username" className="h-14 min-w-0 flex-1 bg-transparent pr-4 text-[16px] font-semibold outline-none sm:text-lg" value={username} onChange={(e) => setUsername(cleanUsername(e.target.value))} placeholder="yourname" />
                  {check.status === 'ok' && <Check className="mr-4 size-5 text-teal" />}
                </div>
                <p className={`mt-2 min-h-5 text-sm font-medium ${check.status === 'ok' ? 'text-teal' : check.status === 'checking' || check.status === 'idle' ? 'text-ink-500' : 'text-red-600'}`}>{check.message}</p>
              </div>
              <p className="mt-6 mb-3 text-sm font-semibold">What do you create?</p>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((n) => (
                  <button key={n} type="button" onClick={() => setNiche(n === niche ? '' : n)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${niche === n ? 'bg-ink text-white' : 'bg-cream hover:bg-cream-300'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-6 mb-3 text-sm font-semibold">Page language</p>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map((l) => (
                  <button key={l.value} type="button" onClick={() => setLanguage(l.value)} className={`h-12 rounded-2xl text-[15px] font-semibold transition ${language === l.value ? 'bg-ink text-white' : 'bg-cream hover:bg-cream-300'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
              {error && <div className="mt-5"><Alert>{error}</Alert></div>}
              <Button size="lg" className="mt-8 w-full sm:w-auto" disabled={check.status !== 'ok'} onClick={() => setStep(2)} arrow>
                Continue
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <span className="inline-flex rounded-full bg-lime px-3.5 py-1.5 text-[13px] font-semibold">Page created 🎉</span>
              <h1 className="display-lg mt-5">
                Make it
                <br />
                <span className="display-italic">live?</span>
              </h1>
              <p className="mt-3 text-ink-500">
                Right now only you can see <b>{PUBLIC_DOMAIN}/{username}</b>. Make it live so visitors can open it. Boxes marked Example stay hidden until you fill them in, and you can switch it off any time with the Live switch.
              </p>
              {error && <div className="mt-5"><Alert>{error}</Alert></div>}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" loading={busy} onClick={goLive}>Make it live <ArrowUpRight className="size-4" /></Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/dashboard/editor', { replace: true })}>Keep it private for now</Button>
              </div>
              {INSTAGRAM_ENABLED && (
                <button type="button" onClick={connectInstagram} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-2">
                  <InstagramIcon size={16} /> Import my photo and bio from Instagram first
                </button>
              )}
            </>
          )}
        </div>
      </main>
      )}
    </div>
  )
}
