import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { APP_NAME } from '../../lib/config'
import { normalizeUrl, whatsappUrl } from '../../lib/embeds'
import { optimizedImage } from '../../lib/images'
import { t } from '../../lib/i18n'
import { socialHref, SOCIALS } from '../../lib/socials'
import { backgroundCss, buttonCss, ensureFont, FONTS, hexAlpha, resolveTheme } from '../../lib/themes'
import { ArrowUpRightIcon, FlagIcon, Logo, PencilIcon, ShareIcon, SOCIAL_ICONS, WhatsappIcon } from '../icons'
import { trackClick } from '../../lib/analytics'
import BlockView from './BlockView'
import ConsentAndPixels from './ConsentAndPixels'

const ShareSheet = lazy(() => import('./ShareSheet'))
const ReportDialog = lazy(() => import('./ReportDialog'))
const ItemModal = lazy(() => import('./ItemModal'))
const LeadPopup = lazy(() => import('./LeadPopup'))
const PreviewNote = lazy(() => import('./PreviewNote'))

// Lives until the page is refreshed or revisited, so moving between pages never reopens the popup
const leadPopupShown = new Set()
const LEAD_POPUP_DELAY = 10000

export function Avatar({ page, size = 96, theme }) {
  const initials = (page.display_name || page.username || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  if (page.avatar_url) {
    return (
      <img
        src={optimizedImage(page.avatar_url, size * 2)}
        alt={page.display_name || page.username}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, boxShadow: `0 0 0 4px ${hexAlpha(theme?.text || '#000', 0.08)}` }}
      />
    )
  }
  return (
    <div
      className="grid place-items-center rounded-full font-display font-bold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: theme?.accent || '#D5F05C', color: '#15161A' }}
    >
      {initials}
    </div>
  )
}

const SECTION_WIDTH = 'mx-auto w-full max-w-6xl px-5 @3xl:px-8'
const BUTTON_TYPES = ['link', 'whatsapp']
// Sections that use the page's full width; everything else reads better in a narrower column
const WIDE_TYPES = ['cards', 'products', 'testimonials', 'image']

/** Top bar: identity, the site's pages, share and the main action */
function SiteBar({ page, theme, nav, active, base, preview, device, onNavigate, onShare, cta, thumbnail, surface }) {
  const notch = preview && device !== 'desktop'
  const items = nav?.length ? [{ slug: null, label: 'Home' }, ...nav] : []
  const home = (
    <>
      <Avatar page={page} theme={theme} size={34} />
      <span className="min-w-0 truncate text-[15px] font-bold" style={{ fontFamily: FONTS[theme.headingFont]?.css }}>
        {page.display_name || `@${page.username}`}
      </span>
    </>
  )
  const homeCls = 'flex min-w-0 items-center gap-2.5'
  const links = items.map((n) => {
    const isActive = (n.slug ?? null) === (active ?? null)
    const style = { background: isActive ? hexAlpha(theme.text, 0.1) : 'transparent', color: theme.text }
    const cls = 'inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition hover:opacity-80'
    const label = <>{n.members && <span aria-hidden>🔒</span>}{n.label}</>
    return preview ? (
      <button key={n.slug ?? 'home'} type="button" onClick={() => onNavigate?.(n.slug)} className={cls} style={style}>{label}</button>
    ) : (
      <Link key={n.slug ?? 'home'} to={n.slug ? `${base}/${n.slug}` : base || '/'} className={cls} style={style} aria-current={isActive ? 'page' : undefined}>{label}</Link>
    )
  })

  return (
    <header className={`sticky top-0 z-30 ${notch ? 'pt-8' : ''}`} style={{ background: surface, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${hexAlpha(theme.text, 0.08)}` }}>
      <div className={`${SECTION_WIDTH} flex h-14 items-center justify-between gap-3`}>
        {preview ? (
          <button type="button" onClick={() => onNavigate?.(null)} className={homeCls}>{home}</button>
        ) : (
          <Link to={base || '/'} className={homeCls}>{home}</Link>
        )}
        {items.length > 0 && <nav className="hidden items-center gap-1 @3xl:flex" aria-label="Pages">{links}</nav>}
        {!thumbnail && (
          <div className="flex shrink-0 items-center gap-2">
            {cta && <span className="hidden @3xl:block">{cta}</span>}
            <button type="button" onClick={onShare} className="grid size-9 place-items-center rounded-full" style={{ background: hexAlpha(theme.text, 0.08) }} aria-label={t(page.language || 'en', 'share')}>
              <ShareIcon size={16} />
            </button>
          </div>
        )}
      </div>
      {items.length > 0 && <nav className="scrollbar-none flex gap-1 overflow-x-auto px-4 pb-2 @3xl:hidden" aria-label="Pages">{links}</nav>}
    </header>
  )
}

function Socials({ page, theme, preview, center }) {
  const socials = SOCIALS.map((s) => ({ ...s, href: socialHref(s.key, page.socials?.[s.key]) })).filter((s) => s.href)
  if (!socials.length) return null
  return (
    <nav className={`flex flex-wrap gap-1.5 ${center ? 'justify-center' : ''}`} aria-label="Social profiles">
      {socials.map((s) => {
        const Icon = SOCIAL_ICONS[s.key]
        return (
          <a key={s.key} href={preview ? undefined : s.href} data-url={s.href} target="_blank" rel="noopener noreferrer me" aria-label={s.label} className="grid size-10 place-items-center rounded-full transition hover:-translate-y-0.5" style={{ background: hexAlpha(theme.text, 0.08) }}>
            {Icon && <Icon size={19} />}
          </a>
        )
      })}
    </nav>
  )
}

/** The hero: name, trust line, about text, main action, social links */
function Hero({ page, theme, preview, device, cta, ctaRef, thumbnail }) {
  const layout = theme.layout || 'classic'
  const heading = { fontFamily: FONTS[theme.headingFont]?.css }
  const name = page.display_name || `@${page.username}`
  const center = layout === 'classic' || layout === 'card'

  const details = (onPhoto) => (
    <>
      <div className="mt-3 empty:hidden"><Socials page={page} theme={onPhoto ? { ...theme, text: '#FFFFFF' } : theme} preview={preview} center={center} /></div>
      {theme.tagline && (
        <span className="mt-3 inline-flex max-w-full rounded-full px-3 py-1 text-xs font-semibold" style={{ background: onPhoto ? 'rgba(255,255,255,0.18)' : hexAlpha(theme.text, 0.08) }}>
          {theme.tagline}
        </span>
      )}
      {page.bio && <p className={`mt-3 max-w-[56ch] text-[15px] leading-relaxed whitespace-pre-line @3xl:text-[17px] ${center ? 'mx-auto' : ''} ${onPhoto ? 'opacity-90' : 'opacity-80'}`}>{page.bio}</p>}
      {cta && <div ref={ctaRef} className="mt-5 max-w-full">{cta}</div>}
    </>
  )

  const heroPhoto = theme.cover || page.avatar_url
  if (layout === 'hero' && heroPhoto) {
    const height = thumbnail ? 340 : preview ? (device === 'desktop' ? 560 : 440) : undefined
    return (
      <section className={`relative flex items-end overflow-hidden ${preview ? '' : 'min-h-[72vh]'}`} style={{ minHeight: height }}>
        <img src={optimizedImage(heroPhoto, 1600)} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className={`${SECTION_WIDTH} relative py-8 text-white @3xl:py-14`}>
          <h1 className="text-[40px] leading-[1.02] font-bold tracking-tight break-words @3xl:text-[72px]" style={heading}>{name}</h1>
          {details(true)}
        </div>
      </section>
    )
  }

  if (layout === 'banner') {
    return (
      <section>
        {theme.cover && <img src={optimizedImage(theme.cover, 1600)} alt="" className="h-48 w-full object-cover @3xl:h-80" />}
        <div className={`${SECTION_WIDTH} pb-4`}>
          <div className={`${theme.cover ? '-mt-11 @3xl:-mt-14' : 'mt-8'} relative inline-block rounded-full`}><Avatar page={page} theme={theme} size={preview && device !== 'desktop' ? 88 : 112} /></div>
          <h1 className="mt-3 text-[32px] leading-tight font-bold tracking-tight break-words @3xl:text-[52px]" style={heading}>{name}</h1>
          {details(false)}
        </div>
      </section>
    )
  }

  if (layout === 'left') {
    const picture = theme.cover || page.avatar_url
    return (
      <section className={`${SECTION_WIDTH} grid items-center gap-6 py-8 @3xl:grid-cols-2 @3xl:gap-12 @3xl:py-16`}>
        <div className="min-w-0">
          {!theme.cover && <div className="mb-4 @3xl:hidden"><Avatar page={page} theme={theme} size={84} /></div>}
          <h1 className="text-[34px] leading-[1.05] font-bold tracking-tight break-words @3xl:text-[60px]" style={heading}>{name}</h1>
          {details(false)}
        </div>
        {picture && <img src={optimizedImage(picture, 1000)} alt="" className={`${theme.cover ? '' : 'hidden @3xl:block'} aspect-[4/3] w-full rounded-3xl object-cover`} />}
      </section>
    )
  }

  if (layout === 'poster') {
    return (
      <section className={`${SECTION_WIDTH} py-10 @3xl:py-20`}>
        <h1 className="leading-[0.95] font-bold tracking-[-0.03em] break-words" style={{ ...heading, fontSize: 'clamp(46px, 12cqw, 136px)' }}>{name}</h1>
        {details(false)}
      </section>
    )
  }

  return (
    <section className={`${SECTION_WIDTH} flex flex-col items-center py-8 text-center @3xl:py-16`}>
      <Avatar page={page} theme={theme} size={preview && device !== 'desktop' ? 88 : 112} />
      <h1 className="mt-4 text-[32px] leading-tight font-bold tracking-tight break-words @3xl:text-[56px]" style={heading}>{name}</h1>
      {details(false)}
    </section>
  )
}

function EditButton({ label, onClick, className = '-top-3 right-3' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`absolute z-20 inline-flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-[11px] font-bold text-ink shadow-lift ring-1 ring-ink/10 ${className}`}>
      <PencilIcon size={12} /> Edit
    </button>
  )
}

function Sections({ blocks, ctx }) {
  const groups = []
  for (const b of blocks) {
    const last = groups[groups.length - 1]
    if (BUTTON_TYPES.includes(b.type) && last?.buttons) last.items.push(b)
    else groups.push({ buttons: BUTTON_TYPES.includes(b.type), items: [b] })
  }
  return groups.map((g) => (
    <div key={g.items[0].id} className={`flex w-full flex-col items-center empty:hidden ${ctx.onEdit || ctx.markSamples ? 'gap-6' : 'gap-3'} ${g.buttons || !WIDE_TYPES.includes(g.items[0].type) ? 'mx-auto max-w-2xl' : ''}`}>
      {g.items.map((b) => {
        const example = ctx.markSamples && b.data?.sample && b.type !== 'products'
        if (!example && !ctx.onEdit) return <BlockView key={b.id} block={b} ctx={ctx} />
        return (
          <div key={b.id} data-block={b.id} className={`relative w-full rounded-3xl ${example ? 'outline-2 outline-offset-4 outline-ink/25 outline-dashed' : ''}`}>
            {example && <span className="absolute -top-3 left-3 z-10 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold text-white">Example</span>}
            {ctx.onEdit && <EditButton label={`Edit ${b.data?.title || 'this section'}`} onClick={() => ctx.onEdit(b.id)} />}
            <BlockView block={b} ctx={ctx} />
          </div>
        )
      })}
    </div>
  ))
}

/**
 * The creator's website. Used for the live site and the dashboard preview (where nothing is
 * tracked and forms don't submit). Layout responds to the page's own width, so it adapts the
 * same way on a phone, in the phone preview and on a desktop.
 */
export default function PageRenderer({
  page, blocks, products = [], preview = false, device = 'phone', className = '',
  nav = [], sitePage = null, base, onNavigate, latestReel = null, thumbnail = false, children, leadPopup = null, markSamples = false, hideSampleProducts = false, onEdit = null, onEditLink = null,
}) {
  base = base ?? `/${page.username}`
  const theme = resolveTheme(page.theme)
  const lang = page.language || 'en'
  const [sheet, setSheet] = useState(null) // 'share' | 'report'
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [previewItem, setPreviewItem] = useState(null)
  const openedHere = useRef(false)
  const ctaRef = useRef(null)
  const [ctaVisible, setCtaVisible] = useState(true)

  useEffect(() => {
    ensureFont(theme.font)
    ensureFont(theme.headingFont)
  }, [theme.font, theme.headingFont])

  // Popups live in the URL (?item=…): they can be shared and the phone's Back button closes them
  const item = preview ? previewItem : params.get('item')
  const openItem = useCallback((id) => {
    if (preview) return setPreviewItem(id)
    openedHere.current = true
    setParams((p) => {
      p.set('item', id)
      return p
    }, { preventScrollReset: true })
  }, [preview, setParams])
  const closeItem = useCallback(() => {
    if (preview) return setPreviewItem(null)
    if (openedHere.current) {
      openedHere.current = false
      navigate(-1)
    } else {
      setParams((p) => {
        p.delete('item')
        return p
      }, { replace: true, preventScrollReset: true })
    }
  }, [preview, navigate, setParams])

  // The main action becomes the hero button (and stays reachable on phones while scrolling)
  const primary = !sitePage ? blocks.find((b) => b.type === 'link' && b.data.primary && (b.data.url || b.data.product_id)) : null
  const rest = primary ? blocks.filter((b) => b !== primary) : blocks
  // Previews show a template's example products until the creator publishes their own
  const samples = preview && !hideSampleProducts && !products?.length ? blocks.find((b) => b.data?.sample_products)?.data.sample_products : null
  const shownProducts = samples || products
  const ctx = { pageId: page.id, username: page.username, base, products: shownProducts, usingSamples: Boolean(samples), markSamples, onEdit, latestReel, theme, lang, preview, displayName: page.display_name, openItem, previewNote: (text, target) => setPreviewNote({ text, target }) }

  const ctaProps = primary && {
    href: primary.data.product_id || preview ? undefined : normalizeUrl(primary.data.url),
    'data-url': primary.data.product_id ? undefined : normalizeUrl(primary.data.url),
    'data-block': primary.id,
    target: '_blank',
    rel: 'noopener noreferrer nofollow',
    onClick: () => {
      if (!preview) trackClick(page.id, primary.id)
      if (primary.data.product_id) openItem(primary.data.product_id)
    },
  }
  const ctaLabel = primary && (
    <>
      {primary.data.emoji && <span aria-hidden>{primary.data.emoji}</span>}
      <span className="min-w-0 truncate">{primary.data.title}</span>
      <ArrowUpRightIcon size={16} className="shrink-0" />
    </>
  )
  const solid = buttonCss({ ...theme, buttonStyle: theme.buttonStyle === 'shadow' ? 'shadow' : 'fill' })
  const heroCta = primary && (
    <span className={`inline-flex max-w-full flex-col gap-1 ${['classic', 'card'].includes(theme.layout || 'classic') ? 'items-center' : 'items-start'}`}>
      <a {...ctaProps} role="button" className="inline-flex h-13 max-w-full cursor-pointer items-center gap-2 px-6 text-[15px] font-bold transition hover:-translate-y-0.5" style={solid}>{ctaLabel}</a>
      {primary.data.subtitle && <span className="text-xs opacity-70">{primary.data.subtitle}</span>}
      <span className="flex items-center gap-1.5 empty:hidden">
        {markSamples && primary.data.sample && <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold text-white">Example</span>}
        {onEdit && <EditButton label="Edit the main button" onClick={() => onEdit(primary.id)} className="static" />}
      </span>
    </span>
  )
  const barCta = primary && <a {...ctaProps} role="button" className="inline-flex h-9 max-w-52 cursor-pointer items-center gap-1.5 px-4 text-sm font-bold" style={solid}>{ctaLabel}</a>

  useEffect(() => {
    if (!ctaRef.current) return setCtaVisible(true)
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting))
    io.observe(ctaRef.current)
    return () => io.disconnect()
  }, [primary?.id])

  // In previews, a tapped link explains where it goes instead of leaving the dashboard
  const [previewNote, setPreviewNote] = useState(null)
  const onPreviewClick = (e) => {
    const a = e.target.closest?.('a')
    if (!a || 'previewOpen' in a.dataset) return
    const url = a.dataset.url || a.getAttribute('href')
    if (!url) return
    e.preventDefault()
    if (url === '/') return
    // Which part of the site this link belongs to, so the popup can go straight to it
    const fromCard = item && !products?.some((p) => p.id === item) ? item.split('.')[0] : null
    const target = a.closest('[data-block]')?.dataset.block || fromCard
    setPreviewNote({ url, target, settings: Boolean(a.closest('[aria-label="Social profiles"]')) })
  }
  const [leadOpen, setLeadOpen] = useState(false)
  const leadPopupId = leadPopup?.id
  const busyElsewhere = Boolean(item || sheet)
  useEffect(() => {
    if (!leadPopupId || preview || busyElsewhere || leadPopupShown.has(page.id)) return
    try {
      if (localStorage.getItem(`lib_lead_${page.id}`)) return
    } catch {
      /* ignore */
    }
    const timer = setTimeout(() => {
      leadPopupShown.add(page.id)
      setLeadOpen(true)
    }, LEAD_POPUP_DELAY)
    return () => clearTimeout(timer)
  }, [leadPopupId, preview, busyElsewhere, page.id])

  const wa = page.whatsapp?.number && (preview ? page.whatsapp.open : true) ? page.whatsapp : null
  const panel = theme.layout === 'card'
  const surface = panel ? theme.cardBg || '#FFFFFF' : hexAlpha(theme.bg, 0.86)
  const showBottomCta = primary && !ctaVisible && !thumbnail && device !== 'desktop'

  return (
    <div
      lang={lang}
      onClickCapture={preview && !thumbnail ? onPreviewClick : undefined}
      className={`relative flex w-full flex-col ${preview ? 'min-h-full' : 'min-h-dvh'} ${className}`}
      style={{ background: backgroundCss(theme, preview), color: theme.text, fontFamily: FONTS[theme.font]?.css }}
    >
      <div className="@container w-full flex-1">
        <div className={panel ? 'mx-auto my-3 max-w-6xl overflow-clip rounded-[28px] shadow-lift @3xl:my-6' : ''} style={panel ? { background: theme.cardBg || '#FFFFFF', width: 'calc(100% - 1.5rem)' } : undefined}>
          <SiteBar page={page} theme={theme} nav={nav} active={sitePage?.slug} base={base} preview={preview} device={device} onNavigate={onNavigate} onShare={() => setSheet('share')} cta={barCta} thumbnail={thumbnail} surface={surface} />

          {sitePage ? (
            <div className={`${SECTION_WIDTH} pt-8 @3xl:pt-14`}>
              <h1 className="text-[34px] leading-tight font-bold tracking-tight break-words @3xl:text-[56px]" style={{ fontFamily: FONTS[theme.headingFont]?.css }}>{sitePage.title}</h1>
            </div>
          ) : (
            <div className="relative">
              {onEdit && <EditButton label="Edit your name, photo and about" onClick={() => onEdit('profile')} className="top-3 right-3" />}
              <Hero page={page} theme={theme} preview={preview} device={device} cta={heroCta} ctaRef={ctaRef} thumbnail={thumbnail} />
            </div>
          )}

          <main className={`${SECTION_WIDTH} flex flex-col gap-8 py-8 @3xl:gap-14 @3xl:py-14`}>
            {children ? <div className="mx-auto w-full max-w-2xl">{children}</div> : <Sections blocks={rest} ctx={ctx} />}
          </main>

          <footer className={`${SECTION_WIDTH} flex flex-col items-center gap-3 pb-8 text-xs`}>
            {page.show_branding !== false && (
              <a href="/" className="inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 font-semibold transition hover:scale-[1.02]" style={{ background: hexAlpha(theme.text, 0.08) }}>
                <Logo size={22} />
                {t(lang, 'madeWith')} {APP_NAME}
              </a>
            )}
            {!preview && (
              <button type="button" onClick={() => setSheet('report')} className="inline-flex items-center gap-1 opacity-50 transition hover:opacity-90">
                <FlagIcon size={12} /> {t(lang, 'report')}
              </button>
            )}
          </footer>
        </div>
      </div>

      {(wa || showBottomCta) && !thumbnail && (
        <div className="pointer-events-none sticky bottom-0 z-40 flex items-center justify-end gap-2 p-3" style={{ paddingBottom: preview ? undefined : 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {showBottomCta && (
            <a {...ctaProps} role="button" className={`pointer-events-auto flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 px-5 text-[15px] font-bold shadow-lift ${preview ? '' : 'md:hidden'}`} style={solid}>{ctaLabel}</a>
          )}
          {wa && (
            <a
              href={preview ? undefined : whatsappUrl(wa.number, wa.message)}
              data-url={whatsappUrl(wa.number, wa.message)}
              data-block="whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => !preview && trackClick(page.id, null)}
              className={`pointer-events-auto inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-[#25D366] text-sm ${wa.label?.trim() && !showBottomCta ? 'px-3' : 'w-12 justify-center'} font-semibold text-white shadow-lift transition hover:scale-105`}
              aria-label={wa.label || t(lang, 'chat')}
            >
              <WhatsappIcon size={22} />
              {!showBottomCta && wa.label?.trim() && <span className="pr-1">{wa.label}</span>}
            </a>
          )}
        </div>
      )}

      {!preview && <ConsentAndPixels pageId={page.id} tracking={page.tracking} lang={lang} />}

      <Suspense fallback={null}>
        {sheet === 'share' && <ShareSheet page={page} lang={lang} onClose={() => setSheet(null)} />}
        {sheet === 'report' && <ReportDialog page={page} onClose={() => setSheet(null)} />}
        {previewNote && <PreviewNote note={previewNote} onClose={() => setPreviewNote(null)} onEdit={onEditLink} />}
        {leadOpen && leadPopup && <LeadPopup block={leadPopup} ctx={ctx} onClose={() => setLeadOpen(false)} />}
        {item && <ItemModal id={item} page={page} blocks={blocks} products={shownProducts} preview={preview} onClose={closeItem} />}
      </Suspense>
    </div>
  )
}
