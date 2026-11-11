import { useState } from 'react'
import { trackClick } from '../../lib/analytics'
import { normalizeUrl } from '../../lib/embeds'
import { formatInr, optimizedImage } from '../../lib/images'
import { FONTS, hexAlpha } from '../../lib/themes'
import { ArrowUpRightIcon } from '../icons'
import { surfaceCss } from './BlockView'

// Static class names so Tailwind generates them. Width is measured on the page, not the screen,
// which keeps the phone preview and a real phone identical.
const GRID = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 @3xl:grid-cols-3',
  4: 'grid-cols-2 @3xl:grid-cols-4',
}

/** One card. `style`: image | overlay | row | plain */
export function SiteCard({ title, text, image, emoji, price, oldPrice, badge, style = 'image', wide, href, onClick, ctx }) {
  const heading = { fontFamily: FONTS[ctx.theme.headingFont]?.css }
  const placeholder = (
    <span className="grid size-full place-items-center text-4xl" style={{ background: hexAlpha(ctx.theme.text, 0.07) }} aria-hidden>
      {emoji || '✨'}
    </span>
  )
  const picture = image ? <img src={optimizedImage(image, 800)} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" /> : placeholder
  const priceLine = (price || badge) && (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
      {price}
      {oldPrice && <span className="text-xs font-medium line-through opacity-50">{oldPrice}</span>}
      {badge && <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-ink uppercase">{badge}</span>}
    </span>
  )

  let body
  if (style === 'overlay') {
    body = (
      <span className={`relative block ${wide ? 'aspect-[16/9]' : 'aspect-[4/5]'} overflow-hidden`}>
        {picture}
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 block p-3.5 text-white">
          <span className="block text-[15px] leading-snug font-bold break-words" style={heading}>{title}</span>
          {text && <span className="mt-0.5 line-clamp-2 block text-xs opacity-85">{text}</span>}
          {priceLine}
        </span>
      </span>
    )
  } else if (style === 'row') {
    body = (
      <span className="flex items-center gap-3 p-2.5">
        <span className="size-16 shrink-0 overflow-hidden rounded-2xl">{picture}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-snug font-bold break-words" style={heading}>{title}</span>
          {text && <span className="mt-0.5 line-clamp-2 block text-xs opacity-70">{text}</span>}
          {priceLine}
        </span>
        <ArrowUpRightIcon size={16} className="mr-1 shrink-0 opacity-50" />
      </span>
    )
  } else if (style === 'plain') {
    body = (
      <span className="block p-4">
        {emoji && <span className="mb-2 block text-2xl" aria-hidden>{emoji}</span>}
        <span className="block text-[15px] leading-snug font-bold break-words" style={heading}>{title}</span>
        {text && <span className="mt-1 line-clamp-3 block text-xs leading-relaxed opacity-70">{text}</span>}
        {priceLine}
      </span>
    )
  } else {
    body = (
      <>
        <span className={`block ${wide ? 'aspect-[16/9]' : 'aspect-[4/3]'} overflow-hidden`}>{picture}</span>
        <span className="block p-3.5">
          <span className="block text-[15px] leading-snug font-bold break-words" style={heading}>{title}</span>
          {text && <span className="mt-0.5 line-clamp-2 block text-xs opacity-70">{text}</span>}
          {priceLine}
        </span>
      </>
    )
  }

  const cls = 'group block h-full w-full overflow-hidden text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lift'
  return href ? (
    <a href={ctx.preview ? undefined : href} data-url={href} target="_blank" rel="noopener noreferrer nofollow" onClick={onClick} className={cls} style={surfaceCss(ctx.theme)}>{body}</a>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={surfaceCss(ctx.theme)}>{body}</button>
  )
}

function SectionTitle({ title, subtitle, ctx }) {
  if (!title && !subtitle) return null
  return (
    <div className="mb-4 text-center @3xl:mb-6">
      {title && <h2 className="text-2xl font-bold tracking-tight @3xl:text-3xl" style={{ fontFamily: FONTS[ctx.theme.headingFont]?.css }}>{title}</h2>}
      {subtitle && <p className="mx-auto mt-1 max-w-[60ch] text-sm opacity-75">{subtitle}</p>}
    </div>
  )
}

function CardsLayout({ columns, count, children }) {
  if (columns === 'swipe') {
    return <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 @3xl:-mx-8 @3xl:px-8">{children}</div>
  }
  // A lone card in a multi-column section shouldn't stretch across the page
  const narrow = Number(columns) === 1 || count === 1
  return <div className={`mx-auto grid gap-3 @3xl:gap-4 ${GRID[columns] || GRID[2]} ${narrow ? 'max-w-2xl' : ''}`}>{children}</div>
}

const swipeCell = (columns) => (columns === 'swipe' ? 'w-[72%] shrink-0 snap-center @3xl:w-[30%]' : 'min-w-0')

/** A section of cards the creator names and arranges */
export function CardsBlock({ block, ctx }) {
  const { title, subtitle, columns = 2, style = 'image', items = [] } = block.data
  const list = items.filter((i) => i.title)
  if (!list.length) return null
  const open = (item, index) => {
    if (!ctx.preview) trackClick(ctx.pageId, block.id)
    if (item.action === 'product' && item.product_id) ctx.openItem(item.product_id)
    else if (item.action !== 'link') ctx.openItem(`${block.id}.${index}`)
  }
  return (
    <section className="w-full">
      <SectionTitle title={title} subtitle={subtitle} ctx={ctx} />
      <CardsLayout columns={columns} count={list.length}>
        {items.map((item, i) => item.title && (
          <div key={item.id || i} className={swipeCell(columns)}>
            <SiteCard
              ctx={ctx}
              style={style}
              wide={Number(columns) === 1}
              title={item.title}
              text={item.text}
              image={item.image}
              emoji={item.emoji}
              price={item.price}
              href={item.action === 'link' && item.url ? normalizeUrl(item.url) : undefined}
              onClick={() => open(item, i)}
            />
          </div>
        ))}
      </CardsLayout>
    </section>
  )
}

const TYPE_EMOJI = { digital: '📥', content: '🔒', bundle: '📦', session: '🎥', webinar: '🗓️', membership: '👑', question: '💬', link: '🛍️' }
const GROUP_LABEL = { digital: 'Downloads', content: 'Paid content', bundle: 'Bundles', session: '1:1 sessions', webinar: 'Webinars', membership: 'Memberships', question: 'Ask me', link: 'Shop' }

/** Older pages stored a layout name instead of columns + style */
function productDisplay(d) {
  if (d.columns) return { columns: d.columns, style: d.style || 'image' }
  if (d.layout === 'carousel') return { columns: 'swipe', style: 'image' }
  if (d.layout === 'list') return { columns: 1, style: 'row' }
  return { columns: 2, style: 'image' }
}

export function ProductsBlock({ block, ctx }) {
  const { title, subtitle, limit = 0 } = block.data
  const { columns, style } = productDisplay(block.data)
  const [group, setGroup] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const all = (ctx.products || []).filter((p) => p.show_on_page !== false)
  if (!all.length) {
    return ctx.preview ? (
      <div className="mx-auto w-full max-w-2xl p-5 text-center text-sm opacity-70" style={surfaceCss(ctx.theme)}>Your products show here once you publish them.</div>
    ) : null
  }
  const types = [...new Set(all.map((p) => p.type))]
  const showFilters = all.length >= 4 && types.length >= 2
  const list = group ? all.filter((p) => p.type === group) : all
  const visible = expanded ? list : list.slice(0, Number(limit) || list.length)
  const chip = (active) => ({ background: active ? ctx.theme.text : hexAlpha(ctx.theme.text, 0.07), color: active ? ctx.theme.bg : ctx.theme.text })

  return (
    <section className="w-full">
      <SectionTitle title={title} subtitle={subtitle} ctx={ctx} />
      {ctx.usingSamples && <p className="mb-3 text-center text-xs font-semibold opacity-60">Examples. Only you can see these until you add your own products.</p>}
      {showFilters && (
        <div className="scrollbar-none -mx-5 mb-4 flex gap-1.5 overflow-x-auto px-5 @3xl:justify-center">
          {[null, ...types].map((t) => (
            <button key={t || 'all'} type="button" onClick={() => { setGroup(t); setExpanded(false) }} className="h-9 shrink-0 rounded-full px-4 text-sm font-semibold" style={chip(group === t)}>
              {t ? GROUP_LABEL[t] : 'All'}
            </button>
          ))}
        </div>
      )}
      <CardsLayout columns={columns} count={visible.length}>
        {visible.map((p) => {
          const isLink = p.type === 'link'
          const per = p.type === 'membership' && p.price_inr > 0 && !p.pay_what_you_want ? ` / ${p.data?.interval === 'year' ? 'yr' : 'mo'}` : ''
          const price = p.pay_what_you_want ? `${formatInr(p.min_price_inr)}+` : p.price_inr ? `${formatInr(p.price_inr)}${per}` : isLink ? null : 'Free'
          const soldOut = p.stock_left === 0
          const onSale = !soldOut && (!!p.sale_ends_at || (p.regular_price_inr != null && p.price_inr < p.regular_price_inr))
          return (
            <div key={p.id} className={swipeCell(columns)}>
              <SiteCard
                ctx={ctx}
                style={style}
                wide={Number(columns) === 1}
                title={p.title}
                text={p.data?.label || GROUP_LABEL[p.type]}
                image={p.thumbnail_url}
                emoji={TYPE_EMOJI[p.type]}
                price={price}
                oldPrice={p.compare_at_inr > p.price_inr ? formatInr(p.compare_at_inr) : null}
                badge={soldOut ? 'Sold out' : onSale ? 'Sale' : null}
                href={isLink && p.data?.url ? normalizeUrl(p.data.url) : undefined}
                onClick={() => {
                  if (!ctx.preview) trackClick(ctx.pageId, null)
                  if (!isLink) ctx.openItem(p.id)
                }}
              />
            </div>
          )
        })}
      </CardsLayout>
      {visible.length < list.length && (
        <button type="button" onClick={() => setExpanded(true)} className="mx-auto mt-4 block h-11 rounded-full px-6 text-sm font-semibold" style={chip(false)}>
          See all {list.length}
        </button>
      )}
    </section>
  )
}
