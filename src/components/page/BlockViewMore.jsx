import { instagramEmbed } from '../../lib/embeds'
import { formatInr } from '../../lib/images'
import { buttonCss, FONTS } from '../../lib/themes'
import { surfaceCss } from './BlockView'

/** Teaser for paid/locked content — the real content lives in a product and unlocks after purchase */
export function LockedBlock({ block, ctx }) {
  const product = (ctx.products || []).find((p) => p.id === block.data.product_id)
  if (!product) return null
  const inner = (
    <>
      <div className="flex items-start gap-3 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ background: ctx.theme.accent, color: '#15161A' }} aria-hidden>🔒</span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold" style={{ fontFamily: FONTS[ctx.theme.headingFont]?.css }}>{block.data.title || product.title}</p>
          {block.data.teaser && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line opacity-80">{block.data.teaser}</p>}
        </div>
      </div>
      <span className="mt-4 flex h-11 w-full items-center justify-center text-sm font-semibold" style={buttonCss({ ...ctx.theme, buttonStyle: 'fill' })}>
        {block.data.button || `Unlock for ${product.price_inr ? formatInr(product.price_inr) : 'free'}`}
      </span>
    </>
  )
  return (
    <button type="button" onClick={() => ctx.openItem(product.id)} className="block w-full p-4 text-left transition hover:-translate-y-0.5 sm:p-5" style={surfaceCss(ctx.theme)}>{inner}</button>
  )
}

/** Always shows the creator's newest Reel (refreshed by the daily Instagram sync) */
export function LatestReelBlock({ block, ctx }) {
  const src = instagramEmbed(ctx.latestReel)
  if (!src) {
    return ctx.preview ? (
      <div className="w-full p-5 text-center text-sm opacity-70" style={surfaceCss(ctx.theme)}>
        Your latest Reel shows here once Instagram is connected and synced.
      </div>
    ) : null
  }
  return (
    <div className="w-full">
      {block.data.title && (
        <p className="mb-2 text-center text-[15px] font-bold" style={{ fontFamily: FONTS[ctx.theme.headingFont]?.css }}>{block.data.title}</p>
      )}
      <div className="w-full overflow-hidden" style={{ ...surfaceCss(ctx.theme), background: '#fff' }}>
        <iframe src={src} title="Latest Instagram Reel" loading="lazy" className="block h-[540px] w-full sm:h-[620px]" scrolling="no" allowTransparency />
      </div>
    </div>
  )
}
