import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Alert, Card, Spinner } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

/** Money in and out: what creators sold, what we earned, refunds and disputes */
export default function AdminMoney() {
  const [m, setM] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.rpc('admin_money').then(({ data, error: err }) => (err ? setError(errorMessage(err)) : setM(data)))
  }, [])
  if (error) return <Alert>{error}</Alert>
  if (!m) return <div className="grid h-60 place-items-center"><Spinner /></div>

  const tiles = [
    ['Creators’ sales (30d)', formatInr(m.gmv_30d), 'bg-lime'],
    ['Creators’ sales, all time', formatInr(m.gmv_total), 'bg-white'],
    ['Plan revenue (30d)', formatInr(m.plan_revenue_30d), 'bg-lilac-100'],
    ['Plan revenue, all time', formatInr(m.plan_revenue_total), 'bg-white'],
    ['Our commission', formatInr(m.commission), 'bg-white'],
    ['Refunded', `${formatInr(m.refunded_total)} (${m.refunded_count})`, 'bg-white'],
    ['Open disputes', m.open_disputes, m.open_disputes > 0 ? 'bg-ink text-white' : 'bg-white'],
    ['DMs sent (30d)', `${m.dm_30d.sent} (${m.dm_30d.failed} failed)`, 'bg-white'],
  ]
  return (
    <div className="space-y-4">
      <PageHeading title="Money." italic="In and out.">Buyers pay Joinlyy through Razorpay. Our commission is the platform charge on each sale, and creators are paid from the Creator payouts page.</PageHeading>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(([k, v, cls]) => (
          <div key={k} className={`rounded-3xl p-5 shadow-soft ${cls}`}>
            <p className={`text-xs font-semibold ${cls.includes('text-white') ? 'text-white/70' : 'text-ink-500'}`}>{k}</p>
            <p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{v}</p>
          </div>
        ))}
      </div>
      <Card className="p-5 sm:p-7">
        <p className="eyebrow text-ink-500">Revenue per day · 30 days</p>
        <div className="mt-4 h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.revenue_daily} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#15161A" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B6E78' }} tickFormatter={(d) => new Date(d).getDate()} minTickGap={12} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B6E78' }} />
              <Tooltip formatter={(v) => formatInr(v)} labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} contentStyle={{ borderRadius: 14, border: 'none' }} />
              <Bar dataKey="sales" name="Creators’ sales" stackId="a" fill="#15161A" />
              <Bar dataKey="plans" name="Plan revenue" stackId="a" fill="#9C8FF0" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-5 sm:p-7">
        <p className="eyebrow text-ink-500">Top creators by sales</p>
        {m.top_creators.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No paid orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/5">
            {m.top_creators.map((c) => (
              <li key={c.username} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="truncate font-medium">{c.display_name || c.username} <span className="text-ink-400">/{c.username}</span></span>
                <span className="shrink-0">{c.orders} orders · <b>{formatInr(c.total)}</b></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
