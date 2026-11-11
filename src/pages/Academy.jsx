import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Clock, Lightbulb } from 'lucide-react'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { APP_NAME } from '../lib/config'
import { ARTICLES, findArticle } from '../lib/academyContent'

function Block({ block }) {
  if (typeof block === 'string') return <p>{block}</p>
  if (block.list) {
    return (
      <ul className="space-y-1.5 pl-5">
        {block.list.map((li) => <li key={li} className="list-disc">{li}</li>)}
      </ul>
    )
  }
  if (block.steps) {
    return (
      <ol className="space-y-2.5">
        {block.steps.map((li, i) => (
          <li key={li} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-lime">{i + 1}</span>
            <span className="pt-0.5">{li}</span>
          </li>
        ))}
      </ol>
    )
  }
  if (block.tip) {
    return (
      <div className="flex gap-3 rounded-2xl bg-lime-200 p-4 text-ink">
        <Lightbulb className="mt-0.5 size-5 shrink-0" />
        <p>{block.tip}</p>
      </div>
    )
  }
  return null
}

function StartCta() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white sm:p-12">
      <div className="absolute -top-20 -right-20 size-56 rounded-full bg-lilac" aria-hidden />
      <div className="relative max-w-xl">
        <p className="eyebrow text-lime">Put it into practice</p>
        <h2 className="display-md mt-3">Your page is free. <span className="italic font-medium text-white/70">Start in two minutes.</span></h2>
        <Link to="/signup" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 text-sm font-semibold text-ink">
          Create my page <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}

function Index() {
  const categories = [...new Set(ARTICLES.map((a) => a.category))]
  return (
    <>
      <section className="card p-6 sm:p-12">
        <p className="eyebrow text-ink-500">{APP_NAME} Academy</p>
        <h1 className="display-xl mt-3">
          Creator guides.<br />
          <span className="display-italic">Practical, desi, free.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-600">
          Short, no-fluff playbooks for Indian creators — set up your page, sell your first product, land brand deals and grow with automation.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c} className="rounded-full bg-cream px-3.5 py-1.5 text-[13px] font-semibold">{c}</span>
          ))}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARTICLES.map((a, i) => (
          <Link key={a.slug} to={`/academy/${a.slug}`} className={`group flex flex-col rounded-3xl p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:p-7 ${a.tone}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow text-ink-500">{a.category}</span>
              <span className="font-display text-sm font-bold text-ink-400">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h2 className="mt-4 font-display text-2xl leading-tight font-bold tracking-tight">{a.title}</h2>
            <p className="mt-3 flex-1 text-[15px] text-ink-600">{a.summary}</p>
            <div className="mt-6 flex items-center justify-between text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5 text-ink-500"><Clock className="size-4" /> {a.minutes} min read</span>
              <span className="grid size-10 place-items-center rounded-full bg-ink text-white transition group-hover:bg-ink-700"><ArrowUpRight className="size-4" /></span>
            </div>
          </Link>
        ))}
      </div>
      <StartCta />
    </>
  )
}

function Article({ article }) {
  const idx = ARTICLES.indexOf(article)
  const next = ARTICLES[(idx + 1) % ARTICLES.length]
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="card p-5 lg:sticky lg:top-28">
          <Link to="/academy" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink">
            <ArrowLeft className="size-4" /> All guides
          </Link>
          <p className="eyebrow mt-5 text-ink-400">On this page</p>
          <nav className="mt-2 flex flex-col gap-0.5" aria-label="Table of contents">
            {article.sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="flex gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-cream hover:text-ink">
                <span className="text-ink-400">{i + 1}.</span> {s.heading}
              </a>
            ))}
          </nav>
        </aside>
        <article className="card min-w-0 p-6 sm:p-12">
          <p className="eyebrow text-ink-500">{article.category} · {article.minutes} min read</p>
          <h1 className="display-lg mt-3">{article.title}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-600">{article.summary}</p>
          <div className="mt-8 space-y-10">
            {article.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="font-display text-2xl font-bold tracking-tight">{s.heading}</h2>
                <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-ink-700">
                  {s.body.map((b, i) => <Block key={i} block={b} />)}
                </div>
              </section>
            ))}
          </div>
          <Link to={`/academy/${next.slug}`} className="mt-12 flex items-center justify-between gap-4 rounded-3xl bg-cream p-5 hover:bg-cream-300 sm:p-6">
            <span className="min-w-0">
              <span className="eyebrow block text-ink-500">Next guide</span>
              <span className="mt-1 block font-display text-lg font-bold">{next.title}</span>
            </span>
            <ArrowUpRight className="size-5 shrink-0" />
          </Link>
        </article>
      </div>
      <StartCta />
    </>
  )
}

export default function Academy() {
  const { slug } = useParams()
  const article = slug ? findArticle(slug) : null

  useEffect(() => {
    document.title = article ? `${article.title} | ${APP_NAME} Academy` : `Creator guides | ${APP_NAME} Academy`
    window.scrollTo(0, 0)
  }, [article])

  if (slug && !article) return <Navigate to="/academy" replace />

  return (
    <>
      <SiteHeader />
      <main className="container-page mt-4 space-y-4 pb-4">
        {article ? <Article article={article} /> : <Index />}
      </main>
      <SiteFooter />
    </>
  )
}
