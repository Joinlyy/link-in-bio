import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { SEO_PAGES } from '../lib/seoPages'
import { ARTICLES } from '../lib/academyContent'
import { applySeo, setJsonLd, SITE_URL } from '../lib/seo'
import { APP_NAME } from '../lib/config'

// Which topic each page belongs to. A page that is not listed here lands in "More".
const TOPICS = [
  ['Instagram automation', ['instagram-comment-to-dm-automation', 'how-to-set-up-comment-to-dm', 'instagram-auto-reply-comments', 'instagram-dm-keywords-that-convert', 'manychat-alternative-india']],
  ['Post scheduler', ['instagram-post-scheduler', 'how-to-schedule-instagram-posts', 'schedule-instagram-reels-free']],
  ['Link in bio', ['link-in-bio-for-indian-creators', 'how-to-add-link-in-bio-instagram', 'link-in-bio-ideas', 'best-link-in-bio-tools-india', 'link-in-bio-templates', 'linktree-alternative-india', 'free-link-in-bio']],
  ['Sell and grow', ['sell-on-instagram-with-upi', 'creator-media-kit-generator']],
]
const TONES = ['bg-lilac-100', 'bg-lime-200', 'bg-cream-200', 'bg-white']

const clean = (title) => title.replace(/\s*[|:]\s*Joinlyy\s*$/i, '').replace(/\s*\|\s*Joinlyy.*$/i, '')

function Card({ to, kicker, title, text, tone, cta = 'Read' }) {
  return (
    <Link to={to} className={`group flex h-full flex-col rounded-3xl p-6 transition hover:-translate-y-1 hover:shadow-soft sm:p-7 ${tone}`}>
      <span className="w-fit rounded-full bg-ink/90 px-3 py-1 text-[11px] font-bold tracking-wide text-white">{kicker}</span>
      <h2 className="mt-4 font-display text-xl leading-snug font-bold tracking-tight">{title}</h2>
      <p className="mt-2 line-clamp-3 text-[14.5px] leading-relaxed text-ink-700">{text}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold">
        {cta} <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  )
}

/** Every guide on one page, as cards that open the full page */
export default function Blog() {
  const [topic, setTopic] = useState('All')
  const [q, setQ] = useState('')

  const cards = useMemo(() => {
    const topicOf = (slug) => TOPICS.find(([, slugs]) => slugs.includes(slug))?.[0] || 'More'
    const pages = SEO_PAGES.filter((p) => p.slug !== 'about').map((p) => ({ key: p.slug, to: `/${p.slug}`, topic: topicOf(p.slug), title: clean(p.title), text: p.description }))
    const guides = ARTICLES.map((a) => ({ key: `a-${a.slug}`, to: `/academy/${a.slug}`, topic: 'Creator Academy', title: a.title, text: a.summary }))
    // Keep the topic order above, then Academy
    const order = [...TOPICS.map(([t]) => t), 'More', 'Creator Academy']
    return [...pages, ...guides].sort((a, b) => order.indexOf(a.topic) - order.indexOf(b.topic))
  }, [])
  const topics = ['All', ...new Set(cards.map((c) => c.topic))]
  const shown = cards.filter((c) => (topic === 'All' || c.topic === topic) && (!q.trim() || `${c.title} ${c.text}`.toLowerCase().includes(q.trim().toLowerCase())))

  useEffect(() => {
    const description = `Guides for Indian creators: Instagram comment to DM automation, the free post scheduler, link in bio, selling with UPI and more, from ${APP_NAME}.`
    applySeo({ title: `Blog: Guides for Indian Creators | ${APP_NAME}`, description, path: '/blog' })
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${APP_NAME} blog`,
      description,
      url: `${SITE_URL}/blog`,
      inLanguage: 'en-IN',
      hasPart: cards.slice(0, 30).map((c) => ({ '@type': 'WebPage', name: c.title, url: `${SITE_URL}${c.to}` })),
    })
    return () => setJsonLd(null)
  }, [cards])

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container-page py-8 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-ink-500">Blog</p>
          <h1 className="display-lg mt-3">
            Guides for creators.
            <br />
            <span className="display-italic">Read, then do it.</span>
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-600">Every guide in one place: Instagram automation, the free post scheduler, link in bio, selling with UPI and growing as an Indian creator.</p>
        </div>

        <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Topic">
            {topics.map((t) => (
              <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)} className={`h-10 rounded-full px-4 text-sm font-semibold ${topic === t ? 'bg-ink text-white' : 'bg-white text-ink-600 ring-1 ring-ink/10 hover:ring-ink/30'}`}>{t}</button>
            ))}
          </div>
          <label className="relative block sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-400" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides" aria-label="Search guides" className="h-10 w-full rounded-full bg-white pr-4 pl-10 text-sm ring-1 ring-ink/10 outline-none focus:ring-ink/40" />
          </label>
        </div>

        {shown.length === 0 ? (
          <p className="mt-16 text-center text-ink-500">No guide matches that. Try another word.</p>
        ) : (
          <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c, i) => (
              <Card key={c.key} to={c.to} kicker={c.topic} title={c.title} text={c.text} tone={TONES[i % TONES.length]} />
            ))}
          </div>
        )}

        <div className="mx-auto mt-10 max-w-5xl rounded-3xl bg-ink p-7 text-white sm:p-10">
          <h2 className="font-display text-2xl font-bold tracking-tight">Ready to try it?</h2>
          <p className="mt-2 max-w-xl text-white/70">Start free: a link in bio page, free comment to DM automation and a free Instagram post scheduler.</p>
          <a href="/signup" className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 text-sm font-semibold text-ink">Start free <ArrowUpRight className="size-4" /></a>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
