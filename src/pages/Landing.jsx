import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowUpRight, BarChart3, CalendarDays, Check, FileText, Languages, Mail, MessageCircle,
  Palette, QrCode, ShieldCheck, Smartphone, Sparkles, Zap,
} from 'lucide-react'
import PageRenderer from '../components/page/PageRenderer'
import PhoneFrame from '../components/PhoneFrame'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { InstagramIcon, YoutubeIcon } from '../components/icons'
import { APP_NAME, INSTAGRAM_ENABLED, PUBLIC_DOMAIN, SUPABASE_KEY, SUPABASE_URL } from '../lib/config'
import { featureList } from '../lib/plans'
import { captureRef } from '../lib/referral'

const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)

const DEMO = {
  page: {
    id: 'demo',
    username: 'priyacooks',
    display_name: 'Priya Sharma',
    bio: 'Home chef · Easy Indian recipes in Hindi & English 🍛',
    theme: { preset: 'cream' },
    language: 'en',
    socials: { instagram: 'priyacooks', youtube: 'priyacooks', whatsapp: '919999999999' },
    show_branding: true,
  },
  blocks: [
    { id: 'b1', type: 'link', data: { title: 'My festive cookbook — ₹299', url: 'https://example.com/book' } },
    { id: 'b2', type: 'webinar', data: { title: 'Live: 5 Diwali sweets in 60 minutes', date: inTenDays, time: '19:00', url: 'https://zoom.us' } },
    { id: 'b3', type: 'whatsapp', data: { title: 'Brand collabs on WhatsApp', phone: '9999999999' } },
    { id: 'b4', type: 'link', data: { title: 'Kitchen tools I actually use', url: 'https://example.com/tools' } },
    { id: 'b5', type: 'lead_form', data: { title: 'Weekly recipe letter', description: 'One easy recipe every Sunday.', collect: 'email' } },
  ],
}

function ClaimBox({ dark = false }) {
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const clean = name.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        navigate(`/signup${clean ? `?username=${clean}` : ''}`)
      }}
      className={`flex w-full max-w-md items-center gap-1 rounded-full p-1.5 pl-5 ${dark ? 'bg-white/10 ring-1 ring-white/15' : 'bg-white shadow-soft ring-1 ring-ink/5'}`}
    >
      <span className={`shrink-0 text-[15px] font-medium ${dark ? 'text-white/60' : 'text-ink-500'}`}>{PUBLIC_DOMAIN}/</span>
      <input
        value={clean}
        onChange={(e) => setName(e.target.value)}
        placeholder="yourname"
        aria-label="Choose your username"
        className={`h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none ${dark ? 'text-white placeholder:text-white/40' : 'placeholder:text-ink-400'}`}
      />
      <button type="submit" className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold sm:px-5 ${dark ? 'bg-lime text-ink' : 'bg-ink text-white'}`}>
        Claim <ArrowUpRight className="size-4" />
      </button>
    </form>
  )
}

function Hero() {
  return (
    <section className="card relative overflow-hidden mt-6">
      <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-6 lg:p-14">
        <div className="relative z-10 flex flex-col">
          <span className="inline-flex w-fit items-center rounded-full bg-lilac-100 px-3.5 py-1.5 text-[13px] font-semibold">
            Your own website · Made for Indian creators
          </span>
          <h1 className="display-xl mt-6">
            Your website.
            <br />
            <span className="display-italic">Ready in minutes.</span>
          </h1>
          <div className="relative mt-8 overflow-hidden rounded-3xl bg-lilac-100 p-6 sm:p-8 lg:mt-auto">
            <svg className="pointer-events-none absolute -right-10 -bottom-6 w-[420px] text-white/70" viewBox="0 0 400 120" fill="none" aria-hidden>
              <path d="M0 90 C 80 10, 140 130, 220 60 S 340 20, 400 70" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
            </svg>
            <p className="relative max-w-lg text-[16px] leading-relaxed text-ink-700 sm:text-[17px]">
              A complete site with pages, products, 1:1 sessions and payments, all from your phone. Pick a template, change anything, and share one address.
              Hindi and English. Free to start.
            </p>
            <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ClaimBox />
            </div>
            <p className="relative mt-3 flex items-center gap-2 text-sm text-ink-500">
              <ArrowDown className="size-4" /> Takes 2 minutes. No card needed.
            </p>
          </div>
        </div>
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="absolute top-6 right-0 size-72 rounded-full bg-lime/60 blur-3xl" aria-hidden />
          <PhoneFrame height={600} className="relative">
            <PageRenderer page={DEMO.page} blocks={DEMO.blocks} preview />
          </PhoneFrame>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const items = [
    { big: '2 min', small: 'from sign-up to a live page', cls: 'bg-white' },
    { big: 'हिंदी + EN', small: 'pages in the language your audience speaks', cls: 'bg-lilac-100' },
    { big: '₹0', small: 'free plan, forever. No ads on your page', cls: 'bg-lime' },
    { big: '<1s', small: 'load time on 4G — built for scale', cls: 'bg-ink text-white' },
  ]
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.big} className={`rounded-3xl p-6 shadow-soft sm:p-7 ${i.cls}`}>
          <p className="font-display text-4xl font-bold tracking-tight sm:text-[44px]">{i.big}</p>
          <p className={`mt-3 text-[15px] ${i.cls.includes('text-white') ? 'text-white/70' : 'text-ink-600'}`}>{i.small}</p>
        </div>
      ))}
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n: '01', icon: Sparkles, title: 'Claim your username', text: `Pick ${PUBLIC_DOMAIN}/yourname, choose your niche and language.`, cls: 'bg-cream-200' },
    INSTAGRAM_ENABLED
      ? { n: '02', icon: InstagramIcon, title: 'Connect Instagram', text: 'We import your photo, name and bio through Meta’s official API and build a starter page.', cls: 'bg-lilac-100' }
      : { n: '02', icon: Palette, title: 'Pick a design', text: 'Choose one of 33 designs. Add your products, videos and forms; switch designs any time without losing anything.', cls: 'bg-lilac-100' },
    { n: '03', icon: Zap, title: 'Paste it in your bio', text: 'Add links, Reels, WhatsApp and webinars. Share the link — watch the clicks roll in.', cls: 'bg-lime' },
  ]
  return (
    <section id="how" className="card scroll-mt-28 p-6 sm:p-12">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <h2 className="display-lg">
          Set up once.
          <br />
          <span className="display-italic">Then just post.</span>
        </h2>
        <a href="/signup" className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-ink/15 px-5 text-sm font-semibold hover:border-ink/40">
          Create your page <ArrowUpRight className="size-4" />
        </a>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className={`rounded-3xl p-6 sm:p-7 ${s.cls}`}>
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-full bg-ink text-white">
                <s.icon size={18} className="size-[18px]" />
              </span>
              <span className="font-display text-4xl font-bold text-ink/15">{s.n}</span>
            </div>
            <h3 className="mt-10 text-xl font-bold">{s.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-28 space-y-4">
      <div className="px-2 pt-8 pb-4">
        <p className="eyebrow text-ink-500">Everything in one place</p>
        <h2 className="display-lg mt-3">
          Built for how India
          <br />
          <span className="display-italic">actually creates.</span>
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-lilac-100 p-7 shadow-soft sm:p-9 lg:col-span-2">
          <span className="grid size-11 place-items-center rounded-full bg-ink text-white"><MessageCircle className="size-5" /></span>
          <h3 className="mt-8 text-2xl font-bold">WhatsApp-first, because your fans are there</h3>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-600">
            One-tap chat and call buttons with a pre-filled message. Collect WhatsApp numbers and emails with proper consent — they land in your dashboard, not a spreadsheet.
          </p>
        </div>
        <div className="rounded-3xl bg-ink p-7 text-white shadow-soft sm:p-9">
          <span className="grid size-11 place-items-center rounded-full bg-lime text-ink"><Languages className="size-5" /></span>
          <h3 className="mt-8 text-2xl font-bold">हिंदी हो या English</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">Write your page in Hindi, English or both. Fonts that render Devanagari beautifully.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: YoutubeIcon, title: 'Reels, YouTube & Spotify', text: 'Embeds that load only when tapped — fast pages, happy fans.', cls: 'bg-white' },
          { icon: CalendarDays, title: 'Webinar links', text: 'Show your next Zoom webinar with date, IST time and a register button.', cls: 'bg-lime' },
          { icon: FileText, title: 'Media kit + PDF', text: INSTAGRAM_ENABLED ? 'Auto-built from your Instagram stats. Share a link or download a PDF for brands.' : 'Built from your page, with your rates. Share a link or download a PDF for brands.', cls: 'bg-white' },
          { icon: QrCode, title: 'QR code for events', text: 'Print it on packaging, standees and business cards.', cls: 'bg-white' },
        ].map((f) => (
          <div key={f.title} className={`rounded-3xl p-7 shadow-soft ${f.cls}`}>
            <span className="grid size-11 place-items-center rounded-full bg-ink text-white"><f.icon size={18} className="size-[18px]" /></span>
            <h3 className="mt-8 text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AnalyticsShowcase() {
  const bars = [38, 52, 30, 64, 70, 100, 58]
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white sm:p-12">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-lilac" aria-hidden />
        <div className="relative">
          <p className="eyebrow text-lime">Analytics</p>
          <h2 className="display-lg mt-4">
            Know what works.
            <br />
            <span className="italic font-medium text-white/60">Post more of it.</span>
          </h2>
          <p className="mt-6 max-w-md text-[16px] leading-relaxed text-white/70">
            Page views, unique visitors, clicks per link, and where your traffic comes from — Instagram, YouTube, WhatsApp or direct. No cookies, no creepy tracking.
          </p>
          <ul className="mt-8 grid gap-3 text-[15px] sm:grid-cols-2">
            {['Clicks per link', 'Traffic sources', 'Devices & browsers', 'Daily & date ranges'].map((x) => (
              <li key={x} className="flex items-center gap-2.5">
                <span className="grid size-5 place-items-center rounded-full bg-lime text-ink"><Check className="size-3" strokeWidth={3} /></span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card p-7 sm:p-10">
        <p className="eyebrow text-ink-500">Page views this week</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <p className="font-display text-5xl font-bold tracking-tight">24,350</p>
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1 text-sm font-semibold">▲ 12%</span>
        </div>
        <div className="mt-10 flex h-44 items-end gap-2 sm:gap-3">
          {bars.map((h, i) => (
            <div key={i} className={`flex-1 rounded-full ${i === 5 ? 'bg-lime' : 'bg-ink'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-8 space-y-2.5">
          {[
            ['Instagram', '68%'],
            ['WhatsApp', '17%'],
            ['YouTube', '11%'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3 text-sm">
              <span className="text-ink-600">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** The same plans and limits as the Plan screen in the dashboard, read straight from the database */
function usePlans() {
  const [plans, setPlans] = useState(null)
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/plans?select=id,name,description,price_monthly_inr,features&is_active=eq.true&order=position`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPlans)
      .catch(() => setPlans([]))
  }, [])
  return plans
}

function Pricing() {
  const plans = usePlans()
  return (
    <section id="pricing" className="card scroll-mt-28 p-6 sm:p-12">
      <h2 className="display-lg">
        Simple.
        <br />
        <span className="display-italic">Free while you grow.</span>
      </h2>
      {plans === null ? (
        <div className="mt-10 h-72 animate-pulse rounded-3xl bg-cream-200" />
      ) : (
        <div className={`mt-10 grid gap-4 ${plans.length > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {plans.map((p, i) => {
            const dark = i === 1
            return (
              <div key={p.id} className={`flex flex-col rounded-3xl p-7 sm:p-9 ${dark ? 'bg-ink text-white' : 'bg-cream-200'}`}>
                <p className={`eyebrow ${dark ? 'text-lime' : 'text-ink-500'}`}>{p.name}</p>
                <p className="mt-4 font-display text-5xl font-bold">
                  ₹{(p.price_monthly_inr || 0).toLocaleString('en-IN')}
                  <span className={`text-lg font-medium ${dark ? 'text-white/50' : 'text-ink-500'}`}>{p.price_monthly_inr ? ' / month' : ' / forever'}</span>
                </p>
                {p.description && <p className={`mt-2 text-sm ${dark ? 'text-white/70' : 'text-ink-600'}`}>{p.description}</p>}
                <ul className="mt-8 space-y-3 text-[15px]">
                  {featureList(p.features || {}).map((f) => (
                    <li key={f.text} className={`flex items-center gap-2.5 ${f.on ? '' : 'opacity-50 line-through'}`}>
                      <Check className="size-4 shrink-0" strokeWidth={3} />
                      {f.text}
                    </li>
                  ))}
                </ul>
                <a href="/signup" className={`mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full pt-0 text-sm font-semibold ${dark ? 'bg-lime text-ink' : 'bg-ink text-white'}`} style={{ marginTop: '2.5rem' }}>
                  {p.price_monthly_inr ? 'Start free, upgrade later' : 'Start free'} <ArrowUpRight className="size-4" />
                </a>
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-5 text-sm text-ink-500">Every plan includes your website, products, bookings, lead forms, analytics and media kit.</p>
    </section>
  )
}

function Trust() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-3xl bg-lime p-7 sm:p-10">
        <span className="grid size-12 place-items-center rounded-full bg-ink text-lime"><ShieldCheck className="size-5" /></span>
        <h2 className="display-md mt-8">Safe for you. Safe for your fans.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-700">
          Every link is checked against a blocklist of phishing and scam domains. Visitors can report pages, and our team reviews every report.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold underline underline-offset-4">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms</a>
        </div>
      </div>
      <div className="card grid gap-8 p-7 sm:grid-cols-2 sm:p-10">
        {[
          { icon: Smartphone, t: 'Mobile-first', d: 'Designed for the 6-inch screen your followers use.' },
          { icon: Palette, t: 'Your style', d: '33 designs, plus your own colours, fonts and button shapes.' },
          { icon: BarChart3, t: 'Privacy-friendly analytics', d: 'No third-party cookies on your page.' },
          { icon: Mail, t: 'Consent built in', d: 'Lead forms record consent, as Indian data law expects.' },
        ].map((x) => (
          <div key={x.t}>
            <x.icon className="size-5" />
            <h3 className="mt-3 font-bold">{x.t}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{x.d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const FAQ = [
  ['Is it really free?', 'Yes. The free plan includes your website, products, bookings, lead capture, analytics and media kit, up to the limits shown in Pricing. Paid plans raise those limits.'],
  ...(INSTAGRAM_ENABLED ? [['Do I need an Instagram business account?', 'To import your profile and stats you need an Instagram Professional (Creator or Business) account. You can still build and publish a page without connecting Instagram.']] : []),
  ['Can I write my page in Hindi?', 'Absolutely. Your page can be in Hindi, English or a mix — choose the page language and we’ll translate buttons like “Share” and “Register” for your visitors.'],
  ['How do webinar links work?', 'Create your webinar in your own Zoom account, then paste the registration link into a Webinar block with the date and time. We show it beautifully and hide it after it ends.'],
  ['What happens to the leads I collect?', 'They’re stored securely and only you can see them. Every lead records the consent text the visitor agreed to. You can export or delete them anytime.'],
  ['Can I delete my account?', 'Yes — from Settings you can export all your data and permanently delete your account and page.'],
]

function Faq() {
  return (
    <section id="faq" className="grid scroll-mt-28 gap-4 lg:grid-cols-[1fr_2fr]">
      <div className="px-2 pt-4">
        <p className="eyebrow text-ink-500">Questions</p>
        <h2 className="display-lg mt-3">
          Good to know
          <br />
          <span className="display-italic">before you start.</span>
        </h2>
      </div>
      <div className="card divide-y divide-ink/10 px-6 sm:px-9">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream text-lg transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 pr-10 text-[15px] leading-relaxed text-ink-600">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-lilac-100 px-6 py-14 text-center sm:py-20">
      <div className="absolute -bottom-20 -left-16 size-64 rounded-full bg-lilac-200" aria-hidden />
      <div className="absolute -top-16 -right-10 size-48 rounded-full bg-lime/70" aria-hidden />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center">
        <h2 className="display-lg">
          Your page is
          <br />
          <span className="display-italic">one username away.</span>
        </h2>
        <p className="mt-5 text-[17px] text-ink-600">Join creators across India running their business from their own website.</p>
        <div className="mt-8 flex w-full justify-center">
          <ClaimBox />
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  useEffect(() => {
    document.title = `${APP_NAME} — Your website, made for Indian creators`
    captureRef()
  }, [])
  return (
    <>
      <SiteHeader />
      <main className="container-page mt-4 space-y-4">
        <Hero />
        <Stats />
        <HowItWorks />
        <Features />
        <AnalyticsShowcase />
        <Pricing />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  )
}
