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
  { href: '/blog', label: 'Blog' },
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

const FOOTER = [
  ['Product', [
    ['a', '/#features', 'Features'],
    ['a', '/#pricing', 'Pricing'],
    ['l', '/sell-on-instagram-with-upi', 'Sell with UPI'],
    ['l', '/creator-media-kit-generator', 'Media kit'],
    ['l', '/link-in-bio-templates', 'Templates'],
    ['a', '/#faq', 'Questions'],
  ]],
  ['Instagram tools', [
    ['l', '/instagram-comment-to-dm-automation', 'Comment to DM automation'],
    ['l', '/how-to-set-up-comment-to-dm', 'Set up comment to DM'],
    ['l', '/instagram-dm-keywords-that-convert', 'Comment keywords'],
    ['l', '/instagram-post-scheduler', 'Post scheduler'],
    ['l', '/schedule-instagram-reels-free', 'Schedule Reels free'],
    ['l', '/manychat-alternative-india', 'ManyChat alternative'],
  ]],
  ['Learn', [
    ['l', '/blog', 'Blog: all guides'],
    ['l', '/academy', 'Creator Academy'],
    ['l', '/link-in-bio-for-indian-creators', 'Link in bio for India'],
    ['l', '/how-to-add-link-in-bio-instagram', 'Add a link in bio'],
    ['l', '/best-link-in-bio-tools-india', 'Choosing a tool'],
    ['l', '/linktree-alternative-india', 'Linktree alternative'],
  ]],
  ['Company', [
    ['l', '/about', 'About Joinlyy'],
    ['l', '/signup', 'Create a page'],
    ['l', '/signin', 'Sign in'],
    ['l', '/privacy', 'Privacy Policy'],
    ['l', '/terms', 'Terms'],
    ['l', '/refund-policy', 'Refund Policy'],
  ]],
]

export function SiteFooter() {
  return (
    <footer className="container-page pt-4 pb-6">
      <div className="card p-6 sm:p-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
          <div className="max-w-sm">
            <Brand />
            <p className="mt-4 text-sm leading-relaxed text-ink-500">
              The link in bio for Indian creators. Sell, book and get paid by UPI, schedule your Instagram posts and auto-reply to every comment, all free to start.
            </p>
            <Link to="/signup" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">
              Start free <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-9 text-sm sm:grid-cols-4">
            {FOOTER.map(([title, links]) => (
              <div key={title} className="min-w-0 space-y-2.5">
                <p className="eyebrow text-ink-400">{title}</p>
                {links.map(([kind, to, label]) =>
                  kind === 'a'
                    ? <a key={label} href={to} className="block font-medium hover:underline">{label}</a>
                    : <Link key={label} to={to} className="block font-medium hover:underline">{label}</Link>,
                )}
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-ink/10 pt-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {APP_NAME}. Made in India, in Indirapuram, Ghaziabad.</p>
          <p>Help: <a href="mailto:support@joinlyy.com" className="font-medium underline-offset-2 hover:underline">support@joinlyy.com</a></p>
        </div>
      </div>
    </footer>
  )
}
