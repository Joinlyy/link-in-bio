import { Fragment, useEffect, useRef, useState } from 'react'
import { applySeo } from '../lib/seo'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowUpRight, BellRing, CalendarClock, CalendarDays, Check, Download, Handshake, IndianRupee,
  MessageCircle, Minus, Palette, ShieldCheck, Sparkles, X, Zap,
} from 'lucide-react'
import PageRenderer from '../components/page/PageRenderer'
import PhoneFrame from '../components/PhoneFrame'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { InstagramIcon } from '../components/icons'
import { APP_NAME, INSTAGRAM_ENABLED, PUBLIC_DOMAIN, SUPABASE_KEY, SUPABASE_URL } from '../lib/config'
import { COMPARE, shortFeatures } from '../lib/plans'
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
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex w-fit items-center rounded-full bg-lilac-100 px-3.5 py-1.5 text-[13px] font-semibold">The link in bio made for Indian creators</span>
            {INSTAGRAM_ENABLED && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime px-3.5 py-1.5 text-[13px] font-semibold">
                <MessageCircle className="size-3.5" /> Free DM &amp; comment automation
              </span>
            )}
          </div>
          <h1 className="display-xl mt-6">
            One link in bio.
            <br />
            <span className="display-italic">Built to get you paid.</span>
          </h1>
          <div className="relative mt-8 overflow-hidden rounded-3xl bg-lilac-100 p-6 sm:p-8 lg:mt-auto">
            <svg className="pointer-events-none absolute -right-10 -bottom-6 w-[420px] text-white/70" viewBox="0 0 400 120" fill="none" aria-hidden>
              <path d="M0 90 C 80 10, 140 130, 220 60 S 340 20, 400 70" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
            </svg>
            <p className="relative max-w-lg text-[16px] leading-relaxed text-ink-700 sm:text-[17px]">
              Sell products, courses and 1:1 calls, get paid by UPI
              {INSTAGRAM_ENABLED ? ', schedule your Instagram posts, auto-reply to every comment with a DM' : ''} and get a WhatsApp ping for every order. In Hindi and English.
            </p>
            <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ClaimBox />
            </div>
            <p className="relative mt-3 flex items-center gap-2 text-sm text-ink-500">
              <ArrowDown className="size-4" /> Free to start. Live in 2 minutes. No card needed.
            </p>
          </div>
        </div>
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="absolute top-6 right-0 size-72 rounded-full bg-lime/60 blur-3xl" aria-hidden />
          <PhoneFrame height={600} className="relative">
            <PageRenderer page={DEMO.page} blocks={DEMO.blocks} preview />
          </PhoneFrame>
          <div className="absolute top-20 -left-2 z-10 hidden items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-ink/5 sm:flex lg:-left-12" aria-hidden>
            <span className="grid size-9 place-items-center rounded-full bg-lime"><IndianRupee className="size-4" /></span>
            <span className="text-left">
              <span className="block text-sm font-bold">₹299 received</span>
              <span className="block text-xs text-ink-500">Festive cookbook · UPI</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Free DM and comment automation, shown front and centre */
function FreeAutomation() {
  if (!INSTAGRAM_ENABLED) return null
  const points = [
    'Comment “GUIDE” on any post or Reel, and the link lands in their DMs',
    'A friendly public reply under the comment, written by you',
    '10 automations and 1,000 DMs a month, free forever',
  ]
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white sm:p-12">
      <div className="absolute -top-20 -right-16 size-72 rounded-full bg-lilac/40" aria-hidden />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div>
          <span className="inline-flex items-center rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">FREE ON EVERY PLAN</span>
          <h2 className="display-lg mt-4">
            Auto-reply to every comment.
            <br />
            <span className="italic font-medium text-white/60">Free DM automation.</span>
          </h2>
          <ul className="mt-6 space-y-3 text-[15px]">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-lime text-ink"><Check className="size-3" strokeWidth={3} /></span>
                <span className="text-white/85">{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-white/55">Need story replies, DM keywords, follow-to-unlock or lead capture? Those come with Creator.</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href="/signup" className="inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 text-sm font-semibold text-ink">
              Start free <ArrowUpRight className="size-4" />
            </a>
            <a href="/how-to-set-up-comment-to-dm" className="text-sm font-semibold text-white underline underline-offset-4">How comment to DM works</a>
            <a href="/instagram-dm-keywords-that-convert" className="text-sm font-semibold text-white/70 underline underline-offset-4">20 keywords that get leads</a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm space-y-3" aria-hidden>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <p className="text-xs text-white/50">New comment · your Reel</p>
            <p className="mt-1 text-[15px]"><span className="font-semibold">@aman.fit</span> guide 🙏</p>
          </div>
          <div className="ml-6 rounded-2xl bg-lime p-4 text-ink">
            <p className="text-xs font-semibold text-ink/60">Public reply</p>
            <p className="mt-1 text-[15px]">Sent! Check your DMs 📩</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-ink">
            <p className="text-xs font-semibold text-ink/50">Instant DM from you</p>
            <p className="mt-1 text-[15px]">Hey Aman! Here’s the free guide 👇</p>
            <span className="mt-3 inline-flex rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white">Get the guide</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function FreeScheduler() {
  if (!INSTAGRAM_ENABLED) return null
  const points = [
    'Upload photos, a multi-photo carousel or a Reel, write the caption, pick the time',
    'Joinlyy publishes it to your Instagram for you, even while you sleep',
    'Free: 1 post a day and 15 Reels a month. Creator: 3 a day, 40 Reels. Pro: 3 a day, 50 Reels',
  ]
  return (
    <section className="relative overflow-hidden rounded-3xl bg-lilac-100 p-7 sm:p-12">
      <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-lime/50" aria-hidden />
      <div className="relative grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <div className="relative mx-auto w-full max-w-sm space-y-3" aria-hidden>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft">
            <span className="grid size-12 place-items-center rounded-xl bg-ink text-lime"><CalendarClock className="size-5" /></span>
            <div>
              <p className="text-sm font-semibold">Reel · Tomorrow, 7:00 pm</p>
              <p className="text-xs text-ink-500">“3 easy dinners under 20 minutes 🍛”</p>
            </div>
            <span className="ml-auto rounded-full bg-lilac-100 px-2.5 py-1 text-[11px] font-bold">Scheduled</span>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft">
            <span className="grid size-12 place-items-center rounded-xl bg-lime text-ink"><InstagramIcon className="size-5" /></span>
            <div>
              <p className="text-sm font-semibold">Carousel · 5 photos</p>
              <p className="text-xs text-ink-500">Posted today, 9:00 am</p>
            </div>
            <span className="ml-auto rounded-full bg-lime px-2.5 py-1 text-[11px] font-bold">Posted</span>
          </div>
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-ink px-3 py-1 text-xs font-bold text-lime">FREE ON EVERY PLAN</span>
          <h2 className="display-lg mt-4">
            Schedule your Instagram posts.
            <br />
            <span className="display-italic">Auto-post, free.</span>
          </h2>
          <ul className="mt-6 space-y-3 text-[15px]">
            {points.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-lime"><Check className="size-3" strokeWidth={3} /></span>
                <span className="text-ink-700">{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href="/signup" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white">
              Start free <ArrowUpRight className="size-4" />
            </a>
            <a href="/instagram-post-scheduler" className="text-sm font-semibold underline underline-offset-4">How the Instagram post scheduler works</a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const items = [
    { icon: IndianRupee, title: 'Get paid by UPI', text: 'Buyers pay by UPI, card or net banking and get access at once. After our platform charge (15%, 10% or 5% by plan) your earning is sent to your UPI ID within 2 working days.', cls: 'bg-lilac-100' },
    ...(INSTAGRAM_ENABLED ? [{ icon: CalendarClock, title: 'Instagram post scheduler', text: 'Schedule photos, carousels and Reels, and Joinlyy posts them for you. Free: 1 post a day and 15 Reels a month.', cls: 'bg-lime' }] : []),
    { icon: Download, title: 'Digital products', text: 'PDFs, presets, templates and bundles, delivered through secure, expiring download links.', cls: 'bg-white' },
    { icon: Sparkles, title: 'Courses & brand picks', text: 'List your course or a product you recommend with its price and a buy link. Buyers pay on your platform or the brand’s site.', cls: 'bg-white' },
    { icon: CalendarDays, title: '1:1 calls & webinars', text: 'Paid sessions with IST time slots and meeting links, or webinars with limited seats.', cls: 'bg-lime' },
    { icon: BellRing, title: 'WhatsApp alerts', text: 'A message the moment someone pays, books, joins your list or sends a brand enquiry.', cls: 'bg-white' },
    { icon: Handshake, title: 'Brand deals & media kit', text: INSTAGRAM_ENABLED ? 'An enquiry form, a deal tracker, GST invoices and a colourful media kit PDF built from your Instagram stats.' : 'An enquiry form, a deal tracker, GST invoices and a colourful media kit PDF with your rates.', cls: 'bg-white' },
  ]
  return (
    <section id="features" className="scroll-mt-28 space-y-4">
      <div className="px-2 pt-8 pb-4">
        <p className="eyebrow text-ink-500">What you can do</p>
        <h2 className="display-lg mt-3">
          Sell, grow and run it all
          <br />
          <span className="display-italic">from one link.</span>
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
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

function HowItWorks() {
  const steps = [
    { n: '01', icon: Sparkles, title: 'Claim your name', text: `Pick ${PUBLIC_DOMAIN}/yourname, your niche and language. Free, with no card.`, cls: 'bg-cream-200' },
    INSTAGRAM_ENABLED
      ? { n: '02', icon: InstagramIcon, title: 'Build your page', text: 'Import your photo and bio from Instagram in one tap, or start from one of 33 designs. Add products and your payout UPI ID.', cls: 'bg-lilac-100' }
      : { n: '02', icon: Palette, title: 'Build your page', text: 'Choose one of 33 designs. Add products, a lead form and your payout UPI ID, and switch designs any time without losing anything.', cls: 'bg-lilac-100' },
    { n: '03', icon: Zap, title: 'Paste it in your bio', text: 'Put one link in your Instagram, YouTube and WhatsApp bios. Orders, leads and brand enquiries reach you on WhatsApp.', cls: 'bg-lime' },
  ]
  return (
    <section id="how" className="card scroll-mt-28 p-6 sm:p-12">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <h2 className="display-lg">
          Live in three steps.
          <br />
          <span className="display-italic">Then just post.</span>
        </h2>
        <a href="/signup" className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-ink/15 px-5 text-sm font-semibold hover:border-ink/40">
          Create your page <ArrowUpRight className="size-4" />
        </a>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((st) => (
          <div key={st.n} className={`rounded-3xl p-6 sm:p-7 ${st.cls}`}>
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-full bg-ink text-white">
                <st.icon size={18} className="size-[18px]" />
              </span>
              <span className="font-display text-4xl font-bold text-ink/15">{st.n}</span>
            </div>
            <h3 className="mt-10 text-xl font-bold">{st.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{st.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Who it's for, as one strip */
function WhoItsFor() {
  const people = ['🎬 Instagram creators', '💪 Coaches & trainers', '📚 Educators', '🎵 Artists & musicians', '🛍️ Small businesses', '🤝 Influencers']
  return (
    <section className="card p-6 sm:p-10">
      <h2 className="display-md">Made for every kind of Indian creator</h2>
      <ul className="mt-5 flex flex-wrap gap-2.5">
        {people.map((p) => (
          <li key={p} className="rounded-full bg-cream px-4 py-2.5 text-[15px] font-medium">{p}</li>
        ))}
      </ul>
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
            Views, clicks on every link, sales per product and where visitors come from: Instagram, YouTube, WhatsApp or direct. No cookies, no creepy tracking.
          </p>
        </div>
      </div>
      <div className="card hidden p-7 sm:p-10 lg:block">
        <p className="eyebrow text-ink-500">Page views this week</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <p className="font-display text-5xl font-bold tracking-tight">24,350</p>
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1 text-sm font-semibold">▲ 12%</span>
        </div>
        <div className="mt-10 flex h-44 items-end gap-3">
          {bars.map((h, i) => (
            <div key={i} className={`flex-1 rounded-full ${i === 5 ? 'bg-lime' : 'bg-ink'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-8 space-y-2.5">
          {[['Instagram', '68%'], ['WhatsApp', '17%'], ['YouTube', '11%']].map(([k, v]) => (
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
    fetch(`${SUPABASE_URL}/rest/v1/plans?select=id,name,description,price_monthly_inr,price_yearly_inr,features&is_active=eq.true&order=position`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPlans)
      .catch(() => setPlans([]))
  }, [])
  return plans
}

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

/** Every feature of every plan, in a pop-up table */
function CompareModal({ plans, period, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const cell = (v) =>
    v === true ? <Check className="mx-auto size-4" strokeWidth={3} aria-label="Included" />
    : v === false ? <Minus className="mx-auto size-4 text-ink-300" aria-label="Not included" />
    : <span className="font-semibold">{v}</span>

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Compare all plan features">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/50 backdrop-blur-sm" tabIndex={-1} />
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-lift">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-4 sm:px-7">
          <h2 className="font-display text-xl font-bold tracking-tight">All features, side by side</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-cream hover:bg-cream-300">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full table-fixed border-collapse text-[13px] sm:text-sm">
            <colgroup>
              <col />
              {plans.map((p) => <col key={p.id} className="w-[66px] sm:w-24" />)}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-500 sm:px-7" scope="col">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} scope="col" className="px-1 py-3 text-center">
                    <span className="block font-display text-sm font-bold sm:text-base">{p.name}</span>
                    <span className="block text-[11px] font-medium text-ink-500 sm:text-xs">
                      {p.price_monthly_inr ? `${inr(period === 'year' ? p.price_yearly_inr : p.price_monthly_inr)}/${period === 'year' ? 'yr' : 'mo'}` : 'Free'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((g) => (
                <Fragment key={g.group}>
                  <tr>
                    <th colSpan={plans.length + 1} className="bg-cream px-4 py-2 text-left text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase sm:px-7" scope="colgroup">{g.group}</th>
                  </tr>
                  {g.rows.map(([label, value]) => (
                    <tr key={label} className="border-b border-ink/5">
                      <th scope="row" className="px-4 py-2.5 text-left font-medium sm:px-7">{label}</th>
                      {plans.map((p) => (
                        <td key={p.id} className="px-1 py-2.5 text-center">{cell(value(p.features || {}))}</td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-ink/10 px-5 py-3 text-center text-xs text-ink-500 sm:px-7">
          Prices are before 18% GST. The platform charge is taken from each sale and the rest is paid to your UPI ID within 2 working days.
        </div>
      </div>
    </div>
  )
}

function Pricing() {
  const plans = usePlans()
  const [period, setPeriod] = useState('month')
  const [open, setOpen] = useState(false)
  return (
    <section id="pricing" className="card scroll-mt-28 p-6 sm:p-12">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <h2 className="display-lg">
          Start free.
          <br />
          <span className="display-italic">Upgrade when you earn.</span>
        </h2>
        <div className="flex w-fit gap-1 rounded-full bg-cream-200 p-1" role="group" aria-label="Billing period">
          {[['month', 'Monthly'], ['year', 'Yearly · 2 months free']].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={period === v} onClick={() => setPeriod(v)} className={`h-10 rounded-full px-4 text-sm font-semibold ${period === v ? 'bg-ink text-white' : 'text-ink-600'}`}>{l}</button>
          ))}
        </div>
      </div>
      {plans === null ? (
        <div className="mt-10 h-72 animate-pulse rounded-3xl bg-cream-200" />
      ) : (
        <>
          <div className={`mt-10 grid gap-4 ${plans.length > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            {plans.map((p, i) => {
              const dark = i === 1
              const price = period === 'year' ? p.price_yearly_inr : p.price_monthly_inr
              return (
                <div key={p.id} className={`flex flex-col rounded-3xl p-7 sm:p-9 ${dark ? 'bg-ink text-white' : 'bg-cream-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`eyebrow ${dark ? 'text-lime' : 'text-ink-500'}`}>{p.name}</p>
                    {dark && <span className="rounded-full bg-lime px-2.5 py-0.5 text-[11px] font-bold text-ink">Most popular</span>}
                  </div>
                  <p className="mt-4 font-display text-5xl font-bold">
                    {inr(price)}
                    <span className={`text-lg font-medium ${dark ? 'text-white/50' : 'text-ink-500'}`}>{p.price_monthly_inr ? (period === 'year' ? ' / year' : ' / month') : ' / forever'}</span>
                  </p>
                  <p className={`mt-1 min-h-5 text-sm ${dark ? 'text-white/70' : 'text-ink-600'}`}>
                    {period === 'year' && p.price_yearly_inr > 0 ? `${inr(Math.round(p.price_yearly_inr / 12))} a month, save ${inr(p.price_monthly_inr * 12 - p.price_yearly_inr)}` : p.description}
                  </p>
                  <ul className="mt-7 space-y-3 text-[15px]">
                    {shortFeatures(p.features || {}).map((f) => (
                      <li key={f.text} className={`flex items-start gap-2.5 ${f.on ? '' : 'opacity-45'}`}>
                        {f.on ? <Check className="mt-0.5 size-4 shrink-0" strokeWidth={3} /> : <Minus className="mt-0.5 size-4 shrink-0" />}
                        {f.text}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <a href="/signup" className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold ${dark ? 'bg-lime text-ink' : 'bg-ink text-white'}`}>
                      {p.price_monthly_inr ? 'Start free, upgrade anytime' : 'Start free'} <ArrowUpRight className="size-4" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-ink-500">Every plan has your own website, products, bookings, lead forms, media kit and the Instagram post scheduler. No setup fees. Prices are before 18% GST; paid plans renew automatically and you can turn that off any time.</p>
            <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-ink/15 px-5 text-sm font-semibold hover:border-ink/40">
              Compare all features <ArrowUpRight className="size-4" />
            </button>
          </div>
          {open && <CompareModal plans={plans} period={period} onClose={() => setOpen(false)} />}
        </>
      )}
    </section>
  )
}

function Trust() {
  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-lime p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-lime"><ShieldCheck className="size-5" /></span>
        <div>
          <h2 className="display-md">Safe for you. Safe for your fans.</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
            Every link is checked against a blocklist of phishing and scam domains. Visitors can report pages, and our team reviews every report.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-x-5 text-sm font-semibold underline underline-offset-4">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms</a>
      </div>
    </section>
  )
}

const FAQ = [
  ['What is a link in bio?', 'One link you put in your Instagram, YouTube or WhatsApp bio. It opens a page with everything you want to share: products, bookings, videos, WhatsApp chat and more.'],
  ['Is it really free?', `Yes. The free plan includes your website, products, bookings, lead capture, analytics and media kit${INSTAGRAM_ENABLED ? ', plus up to 10 comment-to-DM automations' : ''}. Paid plans raise the limits and add extras like WhatsApp alerts and your own domain.`],
  ['How do I get paid, and do you take a cut?', 'Buyers pay on your page by UPI, card or net banking, and their access opens at once. We keep a platform charge of 15% on Starter, 10% on Creator and 5% on Pro, and send the rest to your UPI ID within 2 working days of each sale. The price you set is final: add GST yourself if it applies to you, we never add anything on top.'],
  ...(INSTAGRAM_ENABLED ? [['Can I schedule Instagram posts?', 'Yes, on every plan. Upload photos, a carousel of up to 10 photos or a Reel, write the caption and pick a time, and Joinlyy publishes it to your connected Instagram account. Starter allows 1 post a day and 15 Reels a month, Creator 3 a day and 40 Reels, Pro 3 a day and 50 Reels.']] : []),
  ['What is your refund policy?', 'Refund requests for a purchase from a creator are handled by email. Send the creator’s name, the product and a screenshot of your payment to support@joinlyy.com. Read the full refund policy at /refund-policy.'],
  ...(INSTAGRAM_ENABLED
    ? [['How does comment-to-DM work?', 'Connect your Instagram Creator or Business account, pick a keyword like “GUIDE” and write your message. When someone comments it, they get a DM with your link. We follow Instagram’s rules: one private reply per comment, within seven days.']]
    : []),
  ['Can I sell my course or other brands’ products?', 'Yes. Add the details and price, and paste the link where it’s sold. Visitors pay on that site (Graphy, Udemy, Amazon or your own), so you never handle that payment.'],
  ['Can I write my page in Hindi?', 'Absolutely: Hindi, English or a mix. We translate buttons like “Share” and “Register” for your visitors.'],
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
          Your link in bio is
          <br />
          <span className="display-italic">one username away.</span>
        </h2>
        <p className="mt-5 text-[17px] text-ink-600">Claim your name, add your first link and start getting paid. Free, in about two minutes.</p>
        <div className="mt-8 flex w-full justify-center">
          <ClaimBox />
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  useEffect(() => {
    applySeo({ title: `${APP_NAME}: Free Link in Bio + Instagram Comment to DM Automation (India)`, description: 'One link in bio to sell, book and get paid by UPI. Schedule your Instagram posts, auto-DM every comment and get WhatsApp alerts. Free for Indian creators, in Hindi and English.', path: '/' })
    captureRef()
  }, [])
  return (
    <>
      <SiteHeader />
      <main className="container-page mt-4 space-y-4">
        <Hero />
        <FreeAutomation />
        <FreeScheduler />
        <Features />
        <HowItWorks />
        <WhoItsFor />
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
