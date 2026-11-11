import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { pageDisplayUrl, pageUrl } from '../../lib/config'
import { t } from '../../lib/i18n'
import { CheckIcon, ShareIcon } from '../icons'
import Sheet from './Sheet'

export default function ShareSheet({ page, lang, onClose }) {
  const url = pageUrl(page.username)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Sheet title={t(lang, 'shareTitle')} onClose={onClose}>
      <div className="flex flex-col items-center rounded-3xl bg-cream p-6">
        <div className="rounded-2xl bg-white p-3 shadow-soft">
          <QRCodeSVG value={`${url}?utm_source=qr`} size={176} level="M" fgColor="#15161A" />
        </div>
        <p className="mt-3 text-center text-sm text-ink-500">{t(lang, 'scanQr')}</p>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-ink/10 bg-cream py-1.5 pr-1.5 pl-4">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{pageDisplayUrl(page.username)}</span>
        <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white">
          {copied ? <CheckIcon size={16} /> : null}
          {copied ? t(lang, 'copied') : t(lang, 'copyLink')}
        </button>
      </div>
      {typeof navigator !== 'undefined' && navigator.share && (
        <button
          type="button"
          onClick={() => navigator.share({ title: page.display_name || page.username, url }).catch(() => {})}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-lime text-sm font-semibold text-ink"
        >
          <ShareIcon size={16} /> {t(lang, 'share')}
        </button>
      )}
    </Sheet>
  )
}
