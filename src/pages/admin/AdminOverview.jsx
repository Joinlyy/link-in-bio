import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatNumber } from '../../lib/embeds'
import { Alert, Card, Spinner } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error: err }) => (err ? setError(err.message) : setStats(data)))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!stats) return <div className="grid h-80 place-items-center"><Spinner /></div>

  const tiles = [
    ['Creators', stats.creators, 'bg-white', '/admin/creators'],
    ['New this week', stats.signups_7d, 'bg-lilac-100'],
    ['Published pages', `${formatNumber(stats.published)} / ${formatNumber(stats.pages)}`, 'bg-lime'],
    ['Open reports', stats.open_reports, stats.open_reports > 0 ? 'bg-rose text-white' : 'bg-white', '/admin/reports'],
    ['Page views (7d)', formatNumber(stats.views_7d), 'bg-ink text-white'],
    ['Link clicks (7d)', formatNumber(stats.clicks_7d), 'bg-white'],
    ['Leads (7d)', formatNumber(stats.leads_7d), 'bg-white'],
    ['Instagram connected', formatNumber(stats.instagram_connected), 'bg-white'],
    ['GMV (30d, test)', `₹${formatNumber(stats.gmv_30d)}`, 'bg-lime', '/admin/orders'],
    ['Orders (30d)', formatNumber(stats.orders_30d), 'bg-white', '/admin/orders'],
    ['Live products', formatNumber(stats.products), 'bg-white'],
    ['Unread messages', stats.unread_messages, stats.unread_messages > 0 ? 'bg-ink text-white' : 'bg-white', '/admin/messages'],
    ['Open fraud flags', stats.open_flags ?? 0, stats.open_flags > 0 ? 'bg-rose text-white' : 'bg-white', '/admin/fraud'],
    ['Open disputes', stats.open_disputes ?? 0, stats.open_disputes > 0 ? 'bg-ink text-white' : 'bg-white', '/admin/disputes'],
    ['Paid creators', stats.paid_creators ?? 0, 'bg-lilac-100', '/admin/plans'],
    ['Domains to activate', stats.pending_domains ?? 0, stats.pending_domains > 0 ? 'bg-lime' : 'bg-white', '/admin/domains'],
  ]

  return (
    <div className="space-y-4">
      <PageHeading title="Platform." italic="At a glance." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(([label, value, cls, to]) => {
          const inner = (
            <>
              <p className={`flex items-center justify-between gap-2 text-xs font-semibold ${cls.includes('text-white') ? 'text-white/70' : 'text-ink-500'}`}>
                {label} {to && <ArrowUpRight className="size-3.5 shrink-0" />}
              </p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{typeof value === 'number' ? formatNumber(value) : value}</p>
            </>
          )
          const tileCls = `rounded-3xl p-5 shadow-soft sm:p-6 ${cls}`
          return to ? (
            <Link key={label} to={to} className={`${tileCls} transition hover:-translate-y-0.5 hover:shadow-lift`}>{inner}</Link>
          ) : (
            <div key={label} className={tileCls}>{inner}</div>
          )
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          ['signups', 'Sign-ups per day', '#15161A'],
          ['views', 'Page views per day', '#9C8FF0'],
        ].map(([key, title, color]) => (
          <Card key={key} className="p-5 sm:p-7">
            <p className="eyebrow text-ink-500">{title} · 30 days</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#15161A" strokeOpacity={0.06} vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B6E78' }} tickFormatter={(d) => new Date(d).getDate()} minTickGap={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#6B6E78' }} />
                  <Tooltip cursor={{ fill: 'rgba(21,22,26,.04)' }} contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 12px 32px -12px rgba(21,22,26,.25)' }} labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                  <Bar dataKey={key} fill={color} radius={[8, 8, 8, 8]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ))}
      </div>
      {stats.open_reports > 0 && (
        <Link to="/admin/reports" className="flex items-center justify-between rounded-3xl bg-ink p-6 text-white">
          <span className="font-semibold">{stats.open_reports} report{stats.open_reports > 1 ? 's' : ''} waiting for review</span>
          <ArrowUpRight className="size-5" />
        </Link>
      )}
    </div>
  )
}
