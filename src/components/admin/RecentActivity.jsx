import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, BadgeIndianRupee, CalendarClock, CreditCard, Globe, LifeBuoy, MessagesSquare, Package, ShoppingBag, TriangleAlert, UserPlus, Wallet } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { Alert, Card, Spinner } from '../ui'
import { InstagramIcon } from '../icons'

const KINDS = {
  signup: ['New creators', UserPlus, 'bg-lime'],
  page_live: ['Page live', Globe, 'bg-lilac-100'],
  product: ['Products', Package, 'bg-cream-200'],
  sale: ['Sales', ShoppingBag, 'bg-lime'],
  plan: ['Plans', CreditCard, 'bg-lilac-100'],
  payout: ['Payouts', Wallet, 'bg-lime'],
  instagram: ['Instagram', InstagramIcon, 'bg-lilac-100'],
  post: ['Scheduled posts', CalendarClock, 'bg-cream-200'],
  post_live: ['Posts live', CalendarClock, 'bg-lime'],
  automation: ['Automations', MessagesSquare, 'bg-cream-200'],
  support: ['Support', LifeBuoy, 'bg-rose/20'],
  dispute: ['Disputes', TriangleAlert, 'bg-rose/20'],
}
const GROUPS = [['all', 'Everything'], ['money', 'Money'], ['creators', 'Creators'], ['instagram', 'Instagram'], ['help', 'Help']]
const GROUP_OF = { sale: 'money', plan: 'money', payout: 'money', signup: 'creators', page_live: 'creators', product: 'creators', instagram: 'instagram', post: 'instagram', post_live: 'instagram', automation: 'instagram', support: 'help', dispute: 'help' }

const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** What creators did in the last 3 days: sign-ups, products, sales, plans, payouts, Instagram and help requests */
export default function RecentActivity({ days = 3 }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [group, setGroup] = useState('all')
  const load = useCallback(() => supabase.rpc('admin_recent_activity', { p_days: days, p_limit: 300 }).then(({ data, error: err }) => (err ? setError(errorMessage(err)) : setRows(data || []))), [days])
  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const shown = (rows || []).filter((r) => group === 'all' || GROUP_OF[r.kind] === group)
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-ink-500"><Activity className="size-3.5" /> Recent activity</p>
          <h2 className="mt-1 font-display text-xl font-bold">What creators did in the last {days} days</h2>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {GROUPS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={group === k} onClick={() => setGroup(k)} className={`h-8 rounded-full px-3.5 text-xs font-semibold ${group === k ? 'bg-ink text-white' : 'bg-cream text-ink-600 hover:bg-cream-300'}`}>{l}</button>
          ))}
        </div>
      </div>

      {error ? <div className="mt-4"><Alert>{error}</Alert></div> : !rows ? (
        <div className="grid h-32 place-items-center"><Spinner /></div>
      ) : shown.length === 0 ? (
        <p className="mt-5 text-sm text-ink-500">Nothing here in the last {days} days.</p>
      ) : (
        <ul className="mt-4 max-h-[26rem] divide-y divide-ink/5 overflow-y-auto pr-1">
          {shown.map((r, i) => {
            const [label, Icon, tone] = KINDS[r.kind] || [r.kind, BadgeIndianRupee, 'bg-cream-200']
            return (
              <li key={`${r.kind}-${r.at}-${i}`} className="flex items-start gap-3 py-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone}`} title={label}><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium break-words">{r.summary}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {r.user_id ? <Link to={`/admin/creators?open=${r.user_id}`} className="font-semibold text-ink-700 underline-offset-2 hover:underline">{r.creator || r.email}</Link> : (r.creator || 'Unknown')}
                    {r.username ? ` · /${r.username}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-400">{ago(r.at)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
