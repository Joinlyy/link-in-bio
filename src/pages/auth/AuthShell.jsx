import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SUPABASE_KEY, SUPABASE_URL } from '../../lib/config'
import { SiteHeader } from '../../components/SiteChrome'

/** Two-column auth layout: form on the left, dark brand panel on the right */
export default function AuthShell({ pill, title, italic, children, panel }) {
  return (
    <>
      <SiteHeader />
      <main className="container-page mt-4 pb-8">
        <div className="card grid overflow-hidden lg:grid-cols-[1fr_1fr]">
          <section className="px-5 py-10 sm:px-12 sm:py-14 lg:px-16 lg:py-20">
            <div className="mx-auto w-full max-w-[460px] lg:mx-0">
              {pill && <span className="inline-flex rounded-full bg-lilac-100 px-3.5 py-1.5 text-[13px] font-semibold">{pill}</span>}
              <h1 className="mt-5 font-display text-[44px] leading-[1.02] font-bold tracking-[-0.03em] sm:text-[64px]">
                {title}
                {italic && (
                  <>
                    <br />
                    <span className="display-italic">{italic}</span>
                  </>
                )}
              </h1>
              <div className="mt-9">{children}</div>
            </div>
          </section>
          <aside className="relative m-3 hidden overflow-hidden rounded-[28px] bg-ink p-12 text-white lg:block">
            {panel || <DefaultPanel />}
          </aside>
        </div>
        <p className="mt-5 text-center text-xs text-ink-500">
          By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </main>
    </>
  )
}

function DefaultPanel() {
  const bars = [44, 62, 36, 70, 78, 100, 72]
  return (
    <>
      <div className="absolute -top-28 -right-28 size-[340px] rounded-full bg-lilac" aria-hidden />
      <div className="absolute -right-16 -bottom-16 size-56 rounded-full bg-ink-700" aria-hidden />
      <div className="relative">
        <p className="eyebrow text-lime">Your page, live in minutes</p>
        <h2 className="mt-4 font-display text-[44px] leading-[1.05] font-bold tracking-tight">
          One link.
          <br />
          Every follower.
        </h2>
      </div>
      <div className="relative mt-16 max-w-[420px] rounded-3xl bg-white p-7 text-ink">
        <p className="eyebrow text-ink-500">Page views this week</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="font-display text-5xl font-bold tracking-tight">24,350</p>
          <span className="rounded-full bg-lime px-3 py-1 text-sm font-semibold">▲ 12%</span>
        </div>
        <div className="mt-8 flex h-28 items-end gap-2.5">
          {bars.map((h, i) => (
            <div key={i} className={`flex-1 rounded-full ${i === 5 ? 'bg-lime' : 'bg-ink'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-ink-500">Sample analytics</p>
      </div>
    </>
  )
}

/** Google sign-in only shows when the provider is enabled in Supabase Auth */
export function useGoogleEnabled() {
  const [enabled, setEnabled] = useState(null) // null while checking
  useEffect(() => {
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => r.json())
      .then((s) => setEnabled(Boolean(s.external?.google)))
      .catch(() => setEnabled(false))
  }, [])
  return enabled
}

export function GoogleButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex h-13 w-full items-center justify-center gap-3 rounded-full border border-ink/15 bg-white text-[15px] font-semibold transition hover:border-ink/40 disabled:opacity-60"
    >
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  )
}

export function Divider({ children = 'or' }) {
  return (
    <div className="my-6 flex items-center gap-4 text-xs font-semibold tracking-widest text-ink-400 uppercase">
      <span className="h-px flex-1 bg-ink/10" />
      {children}
      <span className="h-px flex-1 bg-ink/10" />
    </div>
  )
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="grid grid-cols-2 rounded-full bg-cream p-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-12 rounded-full text-[15px] font-semibold transition ${value === o.value ? 'bg-ink text-white shadow' : 'text-ink-500 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
