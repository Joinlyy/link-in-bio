import { useState } from 'react'
import { trackClick } from '../../lib/analytics'
import { faviconUrl, instagramEmbed, normalizeUrl, spotifyEmbed, whatsappUrl, youtubeId } from '../../lib/embeds'
import { optimizedImage } from '../../lib/images'
import { submitLead } from '../../lib/publicApi'
import { t } from '../../lib/i18n'
import { buttonCss, FONTS, hexAlpha, RADIUS } from '../../lib/themes'
import { ArrowUpRightIcon, CalendarIcon, CheckIcon, PhoneIcon, PlayIcon, WhatsappIcon } from '../icons'
import { CountdownBlock, EnquiryBlock, FaqBlock, TestimonialsBlock, TipBlock } from './BlockViewExtra'
import { CardsBlock, ProductsBlock } from './SiteCards'
import { LatestReelBlock, LockedBlock } from './BlockViewMore'

export function surfaceCss(theme) {
  return {
    background: hexAlpha(theme.text, 0.06),
    border: `1px solid ${hexAlpha(theme.text, 0.1)}`,
    borderRadius: theme.radius === 'square' ? RADIUS.square : '22px',
  }
}

function useClick(ctx, blockId) {
  return () => {
    if (!ctx.preview) trackClick(ctx.pageId, blockId)
  }
}

function LinkButton({ href, dataUrl, onClick, theme, children, icon, highlight, primary, newTab = true }) {
  return (
    <a
      href={href}
      data-url={dataUrl}
      onClick={onClick}
      target={newTab ? '_blank' : undefined}
      rel="noopener noreferrer nofollow"
      className={`group relative flex ${primary ? 'min-h-[68px]' : 'min-h-[56px]'} w-full cursor-pointer items-center gap-3 px-4 py-3 text-[15px] font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 ${highlight ? 'animate-[pulse_2.4s_ease-in-out_3]' : ''}`}
      style={buttonCss(theme)}
    >
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full">{icon}</span>
      <span className="min-w-0 flex-1 text-center leading-snug break-words">{children}</span>
      <span className="grid size-9 shrink-0 place-items-center opacity-60 transition group-hover:opacity-100">
        <ArrowUpRightIcon size={18} />
      </span>
    </a>
  )
}

function LinkBlock({ block, ctx }) {
  const { title, url, thumbnail, highlight, emoji, subtitle, primary, product_id: productId } = block.data
  const track = useClick(ctx, block.id)
  const onClick = () => {
    track()
    if (productId) ctx.openItem(productId)
  }
  if (!url && !productId) return null
  const thumb = thumbnail || (emoji || !url ? null : faviconUrl(url))
  return (
    <LinkButton
      href={ctx.preview || productId ? undefined : normalizeUrl(url)}
      dataUrl={productId ? undefined : normalizeUrl(url)}
      onClick={onClick}
      theme={primary ? { ...ctx.theme, buttonStyle: ctx.theme.buttonStyle === 'shadow' ? 'shadow' : 'fill' } : ctx.theme}
      highlight={highlight}
      primary={primary}
      icon={emoji ? <span className="text-xl" aria-hidden>{emoji}</span> : thumb ? <img src={optimizedImage(thumb, 96)} alt="" loading="lazy" className={thumbnail ? 'size-9 rounded-full object-cover' : 'size-5'} /> : null}
    >
      <span className={`block ${primary ? 'text-[17px] font-bold' : ''}`}>{title || url}</span>
      {subtitle && <span className="mt-0.5 block text-xs font-medium opacity-75">{subtitle}</span>}
    </LinkButton>
  )
}

function WhatsappBlock({ block, ctx }) {
  const { title, phone, message, mode } = block.data
  const onClick = useClick(ctx, block.id)
  if (!phone) return null
  const isCall = mode === 'call'
  if (!title?.trim()) {
    return (
      <a
        href={isCall ? `tel:+${whatsappUrl(phone).split('/').pop()}` : whatsappUrl(phone, message)}
        onClick={onClick}
        target={isCall ? undefined : '_blank'}
        rel="noopener noreferrer nofollow"
        aria-label={t(ctx.lang, isCall ? 'call' : 'chat')}
        className="mx-auto grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-soft transition hover:-translate-y-0.5"
      >
        {isCall ? <PhoneIcon size={24} /> : <WhatsappIcon size={26} />}
      </a>
    )
  }
  return (
    <LinkButton
      href={isCall ? `tel:+${whatsappUrl(phone).split('/').pop()}` : whatsappUrl(phone, message)}
      onClick={onClick}
      theme={ctx.theme}
      newTab={!isCall}
      icon={isCall ? <PhoneIcon size={20} /> : <WhatsappIcon size={22} />}
    >
      {title}
    </LinkButton>
  )
}

function YoutubeBlock({ block, ctx }) {
  const id = youtubeId(block.data.url)
  const [playing, setPlaying] = useState(false)
  const onClick = useClick(ctx, block.id)
  if (!id) return null
  return (
    <figure className="w-full overflow-hidden" style={surfaceCss(ctx.theme)}>
      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={block.data.title || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              onClick()
              setPlaying(true)
            }}
            className="group absolute inset-0 size-full"
            aria-label={t(ctx.lang, 'play')}
          >
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/25">
              <span className="grid size-14 place-items-center rounded-full bg-white/95 text-ink shadow-lg transition group-hover:scale-105">
                <PlayIcon size={22} />
              </span>
            </span>
          </button>
        )}
      </div>
      {block.data.title && <figcaption className="px-4 py-3 text-sm font-semibold">{block.data.title}</figcaption>}
    </figure>
  )
}

function InstagramBlock({ block, ctx }) {
  const src = instagramEmbed(block.data.url)
  if (!src) return null
  return (
    <div className="w-full overflow-hidden bg-white" style={{ ...surfaceCss(ctx.theme), background: '#fff' }}>
      <iframe src={src} title="Instagram post" loading="lazy" className="block h-[540px] w-full sm:h-[620px]" scrolling="no" allowTransparency />
    </div>
  )
}

function SpotifyBlock({ block, ctx }) {
  const embed = spotifyEmbed(block.data.url)
  if (!embed) return null
  return (
    <iframe
      src={embed.src}
      title="Spotify"
      loading="lazy"
      className="block w-full"
      style={{ height: embed.compact ? 152 : 352, borderRadius: ctx.theme.radius === 'square' ? 6 : 16 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  )
}

function TextBlock({ block, ctx }) {
  if (!block.data.text) return null
  return (
    <p className="w-full px-1 text-[15px] leading-relaxed whitespace-pre-line opacity-85" style={{ textAlign: block.data.align || 'center', fontFamily: FONTS[ctx.theme.font]?.css }}>
      {block.data.text}
    </p>
  )
}

function HeadingBlock({ block, ctx }) {
  if (!block.data.text) return null
  return (
    <h2 className="w-full px-1 pt-3 text-center text-xl font-bold tracking-tight" style={{ fontFamily: FONTS[ctx.theme.headingFont]?.css }}>
      {block.data.text}
    </h2>
  )
}

function DividerBlock({ ctx }) {
  return <hr className="my-1 w-full border-0 border-t" style={{ borderColor: hexAlpha(ctx.theme.text, 0.15) }} />
}

function ImageBlock({ block, ctx }) {
  const onClick = useClick(ctx, block.id)
  const { image, alt, url } = block.data
  if (!image) return null
  const img = (
    <img
      src={optimizedImage(image, 900)}
      alt={alt || ''}
      loading="lazy"
      className="block h-auto w-full object-cover"
      style={{ borderRadius: ctx.theme.radius === 'square' ? 6 : 22 }}
    />
  )
  return url ? (
    <a href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer nofollow" onClick={onClick} className="block w-full transition hover:opacity-95">
      {img}
    </a>
  ) : (
    <div className="w-full">{img}</div>
  )
}

function webinarDate(data) {
  if (!data.date) return null
  const d = new Date(`${data.date}T${data.time || '00:00'}:00+05:30`)
  return Number.isNaN(d.getTime()) ? null : d
}

function WebinarBlock({ block, ctx }) {
  const onClick = useClick(ctx, block.id)
  const { title, url, description } = block.data
  const when = webinarDate(block.data)
  const ended = when && when.getTime() + 3 * 3600_000 < Date.now()
  if (!title && !url) return null
  const locale = ctx.lang === 'hi' ? 'hi-IN' : 'en-IN'
  return (
    <div className="w-full p-4 sm:p-5" style={surfaceCss(ctx.theme)}>
      <div className="flex items-start gap-4">
        {when && (
          <div className="grid w-14 shrink-0 place-items-center rounded-2xl py-2 text-center" style={{ background: ctx.theme.accent, color: '#15161A' }}>
            <span className="text-[10px] font-bold tracking-widest uppercase">{when.toLocaleDateString(locale, { month: 'short', timeZone: 'Asia/Kolkata' })}</span>
            <span className="font-display text-2xl leading-none font-bold">{when.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow opacity-60">{ended ? t(ctx.lang, 'ended') : t(ctx.lang, 'webinar')}</p>
          <h3 className="mt-1 text-[17px] leading-snug font-bold" style={{ fontFamily: FONTS[ctx.theme.headingFont]?.css }}>
            {title}
          </h3>
          {when && (
            <p className="mt-1 flex items-center gap-1.5 text-sm opacity-75">
              <CalendarIcon size={14} />
              {when.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
            </p>
          )}
          {description && <p className="mt-2 text-sm leading-relaxed opacity-80">{description}</p>}
        </div>
      </div>
      {url && !ended && (
        <a
          href={normalizeUrl(url)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={onClick}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold transition hover:opacity-90"
          style={buttonCss({ ...ctx.theme, buttonStyle: ctx.theme.buttonStyle === 'outline' ? 'outline' : 'fill' })}
        >
          {block.data.button || t(ctx.lang, 'register')} <ArrowUpRightIcon size={16} />
        </a>
      )}
    </div>
  )
}

function LeadFormBlock({ block, ctx }) {
  const { title, description, collect = 'email', button } = block.data
  const [form, setForm] = useState({ name: '', email: '', phone: '', consent: false })
  const [state, setState] = useState({ status: 'idle', error: '' })
  const consentText = t(ctx.lang, 'consent', { name: ctx.displayName || 'the creator' })
  const inputStyle = {
    background: hexAlpha(ctx.theme.text, 0.06),
    border: `1px solid ${hexAlpha(ctx.theme.text, 0.15)}`,
    color: ctx.theme.text,
    borderRadius: ctx.theme.radius === 'square' ? 6 : 14,
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (ctx.preview) return setState({ status: 'done', error: '' })
    setState({ status: 'loading', error: '' })
    try {
      await submitLead({
        p_page_id: ctx.pageId,
        p_block_id: block.id,
        p_name: form.name,
        p_email: collect !== 'phone' ? form.email : null,
        p_phone: collect !== 'email' ? form.phone : null,
        p_consent: form.consent,
        p_consent_text: consentText,
      })
      setState({ status: 'done', error: '' })
      try {
        localStorage.setItem(`lib_lead_${ctx.pageId}`, '1')
      } catch {
        /* ignore */
      }
    } catch (err) {
      setState({ status: 'idle', error: err.message })
    }
  }

  // The creator can send people to their own form instead
  if (block.data.action === 'link' && block.data.url) {
    return (
      <div className="w-full p-4 sm:p-5" style={surfaceCss(ctx.theme)}>
        {title && <h3 className="text-[17px] font-bold" style={{ fontFamily: FONTS[ctx.theme.headingFont]?.css }}>{title}</h3>}
        {description && <p className="mt-1 text-sm opacity-75">{description}</p>}
        <a href={normalizeUrl(block.data.url)} target="_blank" rel="noopener noreferrer nofollow" onClick={() => !ctx.preview && trackClick(ctx.pageId, block.id)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold" style={buttonCss({ ...ctx.theme, buttonStyle: 'fill' })}>
          {button || t(ctx.lang, 'subscribe')} <ArrowUpRightIcon size={16} />
        </a>
      </div>
    )
  }

  return (
    <div className="w-full p-4 sm:p-5" style={surfaceCss(ctx.theme)}>
      {title && (
        <h3 className="text-[17px] font-bold" style={{ fontFamily: FONTS[ctx.theme.headingFont]?.css }}>
          {title}
        </h3>
      )}
      {description && <p className="mt-1 text-sm opacity-75">{description}</p>}
      {state.status === 'done' ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold" style={{ background: hexAlpha(ctx.theme.text, 0.08) }}>
          <CheckIcon size={18} /> {t(ctx.lang, 'thanks')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-2.5">
          <input className="h-11 w-full px-3.5 text-sm outline-none placeholder:opacity-60" style={inputStyle} placeholder={t(ctx.lang, 'name')} value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          {collect !== 'phone' && (
            <input className="h-11 w-full px-3.5 text-sm outline-none placeholder:opacity-60" style={inputStyle} type="email" required placeholder={t(ctx.lang, 'email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
          )}
          {collect !== 'email' && (
            <input className="h-11 w-full px-3.5 text-sm outline-none placeholder:opacity-60" style={inputStyle} type="tel" inputMode="tel" required={collect === 'phone'} placeholder={t(ctx.lang, 'phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
          )}
          <label className="flex items-start gap-2.5 pt-1 text-xs leading-relaxed opacity-80">
            <input type="checkbox" required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5 size-4 shrink-0" style={{ accentColor: ctx.theme.buttonBg }} />
            <span>{consentText}</span>
          </label>
          {state.error && <p className="text-xs font-semibold text-red-500">{state.error}</p>}
          <button type="submit" disabled={state.status === 'loading'} className="flex h-11 w-full items-center justify-center text-sm font-semibold transition hover:opacity-90 disabled:opacity-60" style={buttonCss({ ...ctx.theme, buttonStyle: ctx.theme.buttonStyle === 'outline' ? 'outline' : 'fill' })}>
            {state.status === 'loading' ? '…' : button || t(ctx.lang, 'submit')}
          </button>
        </form>
      )}
    </div>
  )
}

const VIEWS = {
  link: LinkBlock,
  whatsapp: WhatsappBlock,
  youtube: YoutubeBlock,
  instagram: InstagramBlock,
  spotify: SpotifyBlock,
  text: TextBlock,
  heading: HeadingBlock,
  divider: DividerBlock,
  image: ImageBlock,
  webinar: WebinarBlock,
  lead_form: LeadFormBlock,
  countdown: CountdownBlock,
  faq: FaqBlock,
  testimonials: TestimonialsBlock,
  enquiry: EnquiryBlock,
  products: ProductsBlock,
  tip: TipBlock,
  cards: CardsBlock,
  locked: LockedBlock,
  latest_reel: LatestReelBlock,
}

export default function BlockView({ block, ctx }) {
  const View = VIEWS[block.type]
  return View ? <View block={block} ctx={ctx} /> : null
}
