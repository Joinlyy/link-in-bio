import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowUpRight, Check } from 'lucide-react'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { findSeoPage } from '../lib/seoPages'
import { applySeo, setJsonLd, SITE_URL } from '../lib/seo'

/** A page written to be found: one topic, plain headings, real answers */
export default function SeoLanding({ slug: fixedSlug }) {
  const params = useParams()
  const page = findSeoPage(fixedSlug || params.slug)

  useEffect(() => {
    if (!page) return
    const path = `/${page.slug}`
    applySeo({ title: page.title, description: page.description, path })
    setJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: page.h1, description: page.description, url: `${SITE_URL}${path}`, inLanguage: 'en-IN' },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: page.kicker, item: `${SITE_URL}${path}` },
        ] },
        { '@type': 'FAQPage', mainEntity: page.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      ],
    })
    return () => setJsonLd(null)
  }, [page])

  if (!page) return <Navigate to="/" replace />
  const related = page.related.map(findSeoPage).filter(Boolean)

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="container-page py-8 sm:py-14">
        <article className="mx-auto max-w-3xl">
          <p className="eyebrow text-ink-500">{page.kicker}</p>
          <h1 className="display-lg mt-3">{page.h1}</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-700">{page.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 text-sm font-semibold text-ink">Create your free page <ArrowUpRight className="size-4" /></Link>
            <Link to="/#pricing" className="inline-flex h-12 items-center rounded-full border border-ink/15 px-6 text-sm font-semibold">See pricing</Link>
          </div>

          {page.sections.map((s) => (
            <section key={s.h2} className="mt-12">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{s.h2}</h2>
              <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-ink-700">
                {s.body.map((b, i) =>
                  typeof b === 'string' ? (
                    <p key={i}>{b}</p>
                  ) : (
                    <ul key={i} className="space-y-2">
                      {b.list.map((li) => (
                        <li key={li} className="flex gap-3"><Check className="mt-1 size-4 shrink-0 text-teal" /><span>{li}</span></li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}

          <section className="mt-14">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Questions</h2>
            <div className="mt-4 divide-y divide-ink/10 rounded-3xl bg-white p-2 shadow-soft">
              {page.faq.map(([q, a]) => (
                <details key={q} className="group p-4">
                  <summary className="cursor-pointer list-none font-semibold">{q}</summary>
                  <p className="mt-2 leading-relaxed text-ink-700">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-14 rounded-3xl bg-ink p-8 text-white">
            <h2 className="font-display text-2xl font-bold">Ready to try it?</h2>
            <p className="mt-2 text-white/70">Set up your page in about ten minutes. The Starter plan is free.</p>
            <Link to="/signup" className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 text-sm font-semibold text-ink">Start free <ArrowUpRight className="size-4" /></Link>
          </section>

          {related.length > 0 && (
            <nav className="mt-12" aria-label="Related pages">
              <p className="eyebrow text-ink-400">Keep reading</p>
              <ul className="mt-3 space-y-2">
                {related.map((r) => <li key={r.slug}><Link to={`/${r.slug}`} className="font-semibold underline underline-offset-4">{r.h1}</Link></li>)}
                <li><Link to="/academy" className="font-semibold underline underline-offset-4">Creator guides from the Academy</Link></li>
              </ul>
            </nav>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
