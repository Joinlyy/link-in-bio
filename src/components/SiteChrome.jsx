import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { APP_NAME, hasStoredSession } from '../lib/config'
import { Logo } from './icons'
import { captureRef } from '../lib/referral'

const NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/#how', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/academy', label: 'Guides' },
  { href: '/#faq', label: 'Questions' },
]

export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-3" aria-label={`${APP_NAME} home`}>
      <Logo size={40} />
      <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">{APP_NAME}</span>
    </Link>
  )
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const signedIn = hasStoredSession()
  useEffect(() => {
    captureRef() // remember ?ref= from any marketing page
  }, [])
  return (
    <header className="container-page sticky top-3 z-50 pt-3">
      <div className="card flex h-[68px] items-center justify-between gap-4 rounded-[28px] px-3 sm:h-[74px] sm:px-4 lg:px-5">
        <Brand />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-full px-4 py-2 text-[15px] font-medium text-ink-600 transition hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link to="/dashboard" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">
              Dashboard <ArrowUpRight className="size-4" />
            </Link>
          ) : (
            <>
              <Link to="/signin" className="hidden h-11 items-center rounded-full border-2 border-lilac-200 px-5 text-sm font-semibold transition hover:border-lilac sm:inline-flex">
                Sign in
              </Link>
              <Link to="/signup" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold whitespace-nowrap text-white sm:px-5">
                Start free <ArrowUpRight className="size-4" />
              </Link>
            </>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} className="grid size-11 place-items-center rounded-full bg-cream lg:hidden" aria-label="Menu" aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="card mt-2 animate-fade-up p-3 lg:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 font-medium hover:bg-cream">
              {n.label}
            </a>
          ))}
          {!signedIn && (
            <Link to="/signin" className="mt-1 block rounded-2xl px-4 py-3 font-semibold hover:bg-cream">
              Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="container-page pt-4 pb-6">
      <div className="card flex flex-col gap-8 p-6 sm:p-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Brand />
          <p className="mt-4 text-sm leading-relaxed text-ink-500">
            Your own website, ready in minutes. Built in India for creators who post in Hindi, English and everything in between.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div className="space-y-2.5">
            <p className="eyebrow text-ink-400">Product</p>
            <a href="/#features" className="block font-medium hover:underline">Features</a>
            <a href="/#pricing" className="block font-medium hover:underline">Pricing</a>
            <Link to="/academy" className="block font-medium hover:underline">Creator guides</Link>
            <a href="/#faq" className="block font-medium hover:underline">Questions</a>
          </div>
          <div className="space-y-2.5">
            <p className="eyebrow text-ink-400">Creators</p>
            <Link to="/signup" className="block font-medium hover:underline">Create a page</Link>
            <Link to="/signin" className="block font-medium hover:underline">Sign in</Link>
          </div>
          <div className="space-y-2.5">
            <p className="eyebrow text-ink-400">Legal</p>
            <Link to="/privacy" className="block font-medium hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="block font-medium hover:underline">Terms</Link>
          </div>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} {APP_NAME}. Made in India.
      </p>
    </footer>
  )
}
