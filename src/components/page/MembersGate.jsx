import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatInr } from '../../lib/images'
import { buttonCss, FONTS, hexAlpha, resolveTheme } from '../../lib/themes'
import { surfaceCss } from './BlockView'

/** Locked members-only sub-page: membership offers + "I already have access" */
export default function MembersGate({ data, base, onUnlock }) {
  const theme = resolveTheme(data.page.theme)
  const memberships = (data.products || []).filter((p) => p.type === 'membership')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    // Accept the full access link (…/order/<token>) or just the token
    const token = value.trim().split('/order/').pop().split(/[?#]/)[0]
    if (!/^[a-f0-9]{24,64}$/.test(token)) return setError('Paste the access link from your membership receipt.')
    setBusy(true)
    setError('')
    try {
      await onUnlock(token)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="w-full p-6 text-center" style={surfaceCss(theme)}>
        <p className="text-4xl" aria-hidden>🔒</p>
        <h2 className="mt-3 text-xl font-bold" style={{ fontFamily: FONTS[theme.headingFont]?.css }}>Members only</h2>
        <p className="mt-1 text-sm opacity-75">Join to unlock this page and everything else for members.</p>
      </div>

      {memberships.map((m) => (
        <Link
          key={m.id}
          to={`${base}/p/${m.id}`}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold transition hover:-translate-y-0.5"
          style={buttonCss(theme)}
        >
          <span className="min-w-0 truncate">{m.title}</span>
          <span className="shrink-0">
            {formatInr(m.price_inr)} / {m.data?.interval === 'year' ? 'year' : 'month'}
          </span>
        </Link>
      ))}

      <form onSubmit={submit} className="w-full p-4" style={surfaceCss(theme)}>
        <p className="text-sm font-semibold">Already a member?</p>
        <div className="mt-2 flex gap-2">
          <input
            className="h-11 min-w-0 flex-1 px-3.5 text-sm outline-none placeholder:opacity-60"
            style={{ background: hexAlpha(theme.text, 0.06), border: `1px solid ${hexAlpha(theme.text, 0.15)}`, color: theme.text, borderRadius: 14 }}
            placeholder="Paste your access link"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" disabled={busy} className="h-11 shrink-0 px-4 text-sm font-semibold disabled:opacity-60" style={buttonCss({ ...theme, buttonStyle: 'fill' })}>
            {busy ? '…' : 'Unlock'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}
      </form>
    </div>
  )
}
