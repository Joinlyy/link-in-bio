import { APP_NAME, pageDisplayUrl } from '../lib/config'
import { formatNumber } from '../lib/embeds'
import { socialHref, SOCIALS } from '../lib/socials'
import { InstagramIcon, Logo, MailIcon, SOCIAL_ICONS } from './icons'
import { Avatar } from './page/PageRenderer'

/** Brand-facing media kit. Light, print-friendly layout (Save as PDF). */
export default function MediaKitView({ page, instagram }) {
  const kit = page.media_kit || {}
  const ig = instagram
  const stats = ig
    ? [
        { label: 'Followers', value: formatNumber(ig.followers_count), cls: 'bg-ink text-white' },
        { label: 'Posts', value: formatNumber(ig.media_count), cls: 'bg-lilac-100' },
        ig.avg_likes != null && { label: 'Avg. likes', value: formatNumber(ig.avg_likes), cls: 'bg-lime' },
        ig.avg_comments != null && { label: 'Avg. comments', value: formatNumber(ig.avg_comments), cls: 'bg-white' },
        ig.engagement_rate != null && { label: 'Engagement rate', value: `${Number(ig.engagement_rate).toFixed(2)}%`, cls: 'bg-white' },
        ig.insights?.reach != null && { label: 'Reach (28 days)', value: formatNumber(ig.insights.reach), cls: 'bg-white' },
      ].filter(Boolean)
    : []
  const socials = SOCIALS.map((s) => ({ ...s, href: socialHref(s.key, page.socials?.[s.key]) })).filter((s) => s.href && s.key !== 'email')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 print:space-y-3">
      <section className="card relative overflow-hidden p-6 sm:p-10 print:shadow-none print:ring-1 print:ring-ink/10">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-lilac-100 print:hidden" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar page={{ ...page, avatar_url: page.avatar_url || ig?.profile_picture_url }} size={112} />
          <div className="min-w-0">
            <p className="eyebrow text-ink-500">Media kit {page.niche ? `· ${page.niche}` : ''}</p>
            <h1 className="mt-2 font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{page.display_name || page.username}</h1>
            <p className="mt-1 text-ink-500">
              {ig?.username ? `@${ig.username} on Instagram` : pageDisplayUrl(page.username)} · {page.language === 'hi' ? 'Hindi' : 'English'} content
            </p>
          </div>
        </div>
        {(kit.headline || page.bio) && <p className="relative mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-700">{kit.headline || page.bio}</p>}
      </section>

      {stats.length > 0 ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-3xl p-5 shadow-soft sm:p-6 print:shadow-none print:ring-1 print:ring-ink/10 ${s.cls}`}>
              <p className={`text-xs font-semibold ${s.cls.includes('text-white') ? 'text-white/60' : 'text-ink-500'}`}>{s.label}</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{s.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {kit.about && (
        <section className="card p-6 sm:p-8 print:shadow-none print:ring-1 print:ring-ink/10">
          <p className="eyebrow text-ink-500">About</p>
          <p className="mt-3 leading-relaxed whitespace-pre-line text-ink-700">{kit.about}</p>
        </section>
      )}

      {kit.services?.length > 0 && (
        <section className="card p-6 sm:p-8 print:shadow-none print:ring-1 print:ring-ink/10">
          <p className="eyebrow text-ink-500">Collaboration formats</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {kit.services.map((s) => (
              <span key={s} className="rounded-full bg-cream px-4 py-2 text-sm font-semibold">{s}</span>
            ))}
          </div>
        </section>
      )}

      {kit.rates?.some((r) => r.format) && (
        <section className="card p-6 sm:p-8 print:break-inside-avoid print:shadow-none print:ring-1 print:ring-ink/10">
          <p className="eyebrow text-ink-500">Rate card</p>
          <div className="mt-4 divide-y divide-ink/10">
            {kit.rates.filter((r) => r.format).map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-3">
                <span className="font-medium">{r.format}</span>
                <span className="font-display text-lg font-bold">{r.price || 'On request'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {ig?.recent_media?.length > 0 && (
        <section className="card p-6 sm:p-8 print:break-inside-avoid print:shadow-none print:ring-1 print:ring-ink/10">
          <p className="eyebrow text-ink-500">Recent posts</p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {ig.recent_media.slice(0, 6).map((m) => (
              <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-2xl bg-cream">
                {m.image && <img src={m.image} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" referrerPolicy="no-referrer" />}
                {m.like_count != null && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">♥ {formatNumber(m.like_count)}</span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-ink p-6 text-white sm:p-8">
        <p className="eyebrow text-lime">Work with me</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 text-[15px]">
            {kit.contact_email && (
              <a href={`mailto:${kit.contact_email}`} className="flex items-center gap-2 font-semibold hover:underline"><MailIcon size={18} /> {kit.contact_email}</a>
            )}
            <a href={`/${page.username}`} className="flex items-center gap-2 text-white/70 hover:underline"><InstagramIcon size={18} /> {pageDisplayUrl(page.username)}</a>
          </div>
          <div className="flex flex-wrap gap-2">
            {socials.map((s) => {
              const Icon = SOCIAL_ICONS[s.key]
              return (
                <a key={s.key} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
                  <Icon size={18} />
                </a>
              )
            })}
          </div>
        </div>
      </section>

      <p className="flex items-center justify-center gap-2 py-2 text-xs text-ink-500">
        <Logo size={20} /> Media kit by {APP_NAME}
        {ig?.last_synced_at && <> · Instagram data as of {new Date(ig.last_synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
      </p>
    </div>
  )
}
