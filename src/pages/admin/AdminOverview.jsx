import RecentActivity from '../../components/admin/RecentActivity'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { formatNumber } from '../../lib/embeds'
import { Alert, Card, Spinner } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [rev, setRev] = useState(null)
  const [plans, setPlans] = useState([])
  const [billing, setBilling] = useState(null)

  useEffect(() => {
    supabase.rpc('admin_money').then(({ data }) => setRev(data))
    supabase.rpc('admin_billing_overview').then(({ data }) => setBilling(data))
    supabase.from('plans').select('id, name, position').order('position').then(({ data }) => setPlans(data || []))
    supabase.rpc('admin_stats').then(({ data, error: err }) => (err ? setError(err.message) : setStats(data)))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!stats) return <div className="grid h-80 place-items-center"><Spinner /></div>

  const by = stats.by_plan || {}
  const paying = stats.paid_creators ?? 0
  const m = rev
  const money = (n) => `₹${formatNumber(n || 0)}`
  const groups = [
    {
      title: 'Needs your attention',
      tiles: [
        ['Buyer support open', stats.open_tickets ?? 0, stats.open_tickets > 0 ? 'bg-ink text-white' : 'bg-white', '/admin/support'],
        ['High priority', stats.high_tickets ?? 0, stats.high_tickets > 0 ? 'bg-rose text-white' : 'bg-white', '/admin/support'],
        ['Failed payments (7d)', stats.failed_orders_7d ?? 0, stats.failed_orders_7d > 0 ? 'bg-rose text-white' : 'bg-white', '/admin/orders'],
        ['Razorpay issues', billing ? billing.open_issues + billing.failed_24h : '…', billing && billing.open_issues + billing.failed_24h > 0 ? 'bg-rose text-white' : 'bg-white', '/admin/razorpay'],
        ['Open disputes', stats.open_disputes ?? 0, stats.open_disputes > 0 ? 'bg-ink text-white' : 'bg-white', '/admin/disputes'],
        ['Fraud flags', stats.open_flags ?? 0, stats.open_flags > 0 ? 'bg-rose text-white' : 'bg-white', '/admin/fraud'],
        ['Open reports', stats.open_reports, stats.open_reports > 0 ? 'bg-rose text-white' : 'bg-white', '/admin/reports'],
        ['Creator messages', stats.unread_messages, stats.unread_messages > 0 ? 'bg-ink text-white' : 'bg-white', '/admin/messages'],
      ],
    },
    {
      title: 'Business',
      tiles: [
        ['Sales volume (30d)', money(stats.gmv_30d), 'bg-lime', '/admin/money'],
        ['Our commission', money(m?.commission), 'bg-white', '/admin/money'],
        ['Plan revenue (30d)', money(m?.plan_revenue_30d), 'bg-lilac-100', '/admin/subscriptions'],
        ['MRR (auto-renewing plans)', billing ? money(billing.mrr) : '…', 'bg-white', '/admin/razorpay'],
        ['Orders (30d)', formatNumber(stats.orders_30d), 'bg-white', '/admin/orders'],
        ['Sales volume, all time', money(stats.gmv_total), 'bg-white', '/admin/orders'],
        ['Orders, all time', formatNumber(stats.orders_total), 'bg-white'],
        ['Creators in total', stats.creators, 'bg-white', '/admin/creators'],
        ['New this week', stats.signups_7d, 'bg-white'],
        ...plans.map((p) => [`${p.name} plan`, by[p.id] || 0, p.id === 'free' ? 'bg-white' : 'bg-lilac-100', '/admin/subscriptions']),
        ['Paying creators', paying, 'bg-lilac-100', '/admin/subscriptions'],
      ],
    },
    {
      title: 'Platform',
      tiles: [
        ['Published pages', `${formatNumber(stats.published)} / ${formatNumber(stats.pages)}`, 'bg-white'],
        ['Live products', formatNumber(stats.products), 'bg-white'],
        ['Page views (7d)', formatNumber(stats.views_7d), 'bg-ink text-white'],
        ['Link clicks (7d)', formatNumber(stats.clicks_7d), 'bg-white'],
        ['Leads (7d)', formatNumber(stats.leads_7d), 'bg-white'],
        ['Instagram connected', formatNumber(stats.instagram_connected), 'bg-white'],
        ['DMs sent (30d)', m ? `${formatNumber(m.dm_30d.sent)} (${formatNumber(m.dm_30d.failed)} failed)` : '…', 'bg-white'],
        ['Suspended creators', stats.suspended ?? 0, 'bg-white', '/admin/creators'],
        ['Domains to activate', stats.pending_domains ?? 0, 'bg-white', '/admin/domains'],
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeading title="Platform." italic="At a glance." />
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="eyebrow mb-3 text-ink-500">{g.title}</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {g.tiles.map(([label, value, cls, to]) => {
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
        </section>
      ))}
      <RecentActivity days={3} />
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
      {m && (
        <Card className="p-5 sm:p-7">
          <p className="eyebrow text-ink-500">Revenue per day · 30 days</p>
          <div className="mt-4 h-56">
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
      )}
      {stats.open_reports > 0 && (
        <Link to="/admin/reports" className="flex items-center justify-between rounded-3xl bg-ink p-6 text-white">
          <span className="font-semibold">{stats.open_reports} report{stats.open_reports > 1 ? 's' : ''} waiting for review</span>
          <ArrowUpRight className="size-5" />
        </Link>
      )}
    </div>
  )
}
