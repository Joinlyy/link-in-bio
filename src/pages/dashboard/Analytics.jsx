import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Check, Copy, Link2, RefreshCw } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { supabase } from '../../lib/supabase'
import { formatNumber } from '../../lib/embeds'
import { formatInr } from '../../lib/images'
import { pageUrl } from '../../lib/config'
import { regionName } from '../../lib/gst'
import { Button, Card, Empty, Input, Spinner, useToast } from '../../components/ui'
import { blockSummary, BLOCK_TYPES } from './blockTypes'
import { DataTable } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

const RANGES = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: 'custom', label: 'Custom' },
]

function istToday() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}
function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function mergeCounts(rows, key) {
  const out = {}
  for (const r of rows) for (const [k, v] of Object.entries(r[key] || {})) out[k] = (out[k] || 0) + v
  return Object.entries(out).sort((a, b) => b[1] - a[1])
}

const LABELS = {
  instagram: 'Instagram', youtube: 'YouTube', whatsapp: 'WhatsApp', direct: 'Direct', facebook: 'Facebook', x: 'X / Twitter',
  google: 'Google', qr: 'QR code', other: 'Other', snapchat: 'Snapchat', sharechat: 'ShareChat', linkedin: 'LinkedIn', telegram: 'Telegram',
  mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', unknown: 'Unknown', chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox',
  edge: 'Edge', samsung: 'Samsung Internet', opera: 'Opera',
}

function Breakdown({ title, rows, color = 'bg-ink', label = (k) => LABELS[k] || k, empty = 'No data yet', note }) {
  const total = rows.reduce((s, [, v]) => s + v, 0)
  return (
    <Card className="min-w-0 p-6">
      <p className="eyebrow text-ink-500">{title}</p>
      {total === 0 ? (
        <p className="mt-6 text-sm text-ink-400">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {rows.slice(0, 6).map(([k, v]) => (
            <li key={k}>
              <div className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate font-medium">{label(k)}</span>
                <span className="shrink-0 pl-2 text-ink-500">
                  {formatNumber(v)} · <b className="text-ink">{Math.round((v / total) * 100)}%</b>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-cream">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${(v / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-4 text-xs text-ink-400">{note}</p>}
    </Card>
  )
}

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')

function Funnel({ steps }) {
  const max = Math.max(1, ...steps.map((s) => s.value))
  return (
    <Card className="min-w-0 p-6 sm:p-7">
      <p className="eyebrow text-ink-500">Funnel</p>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="shrink-0 text-ink-500">
                {i > 0 && <span className="mr-2 text-xs">{pct(s.value, steps[i - 1].value)} of previous</span>}
                <b className="font-display text-lg text-ink">{formatNumber(s.value)}</b>
              </span>
            </div>
            <div className="mt-1.5 h-3 rounded-full bg-cream">
              <div className={`h-3 rounded-full ${s.color}`} style={{ width: `${Math.max(s.value ? 2 : 0, (s.value / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink-400">Product views can exceed clicks when people open product links directly.</p>
    </Card>
  )
}

const UTM_SOURCES = ['instagram', 'youtube', 'whatsapp', 'email', 'x', 'facebook']

function UtmBuilder({ username }) {
  const toast = useToast()
  const [u, setU] = useState({ source: 'instagram', medium: '', campaign: '' })
  const [copied, setCopied] = useState(false)
  const slug = (v) => v.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  const params = new URLSearchParams()
  if (slug(u.source)) params.set('utm_source', slug(u.source).slice(0, 32))
  if (slug(u.medium)) params.set('utm_medium', slug(u.medium).slice(0, 32))
  if (slug(u.campaign)) params.set('utm_campaign', slug(u.campaign).slice(0, 64))
  const qs = params.toString()
  const url = `${pageUrl(username)}${qs ? `?${qs}` : ''}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('Couldn’t copy — select the link and copy it manually', 'error')
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <Link2 className="size-4" />
        <p className="eyebrow text-ink-500">Campaign link builder</p>
      </div>
      <p className="mt-2 text-sm text-ink-500">Tag the links you share so you can see which post, story or email brought people in.</p>
      <div className="scrollbar-none mt-4 flex gap-1.5 overflow-x-auto">
        {UTM_SOURCES.map((s) => (
          <button key={s} type="button" onClick={() => setU({ ...u, source: s })} className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold ${u.source === s ? 'bg-ink text-white' : 'bg-cream'}`}>
            {s === 'email' ? 'Email' : LABELS[s] || s}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Input label="Source" value={u.source} placeholder="instagram" onChange={(e) => setU({ ...u, source: e.target.value })} />
        <Input label="Medium" value={u.medium} placeholder="story, bio, reel" onChange={(e) => setU({ ...u, medium: e.target.value })} />
        <Input label="Campaign" value={u.campaign} placeholder="diwali-sale" onChange={(e) => setU({ ...u, campaign: e.target.value })} />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 rounded-2xl bg-cream px-4 py-3 text-xs break-all">{url}</code>
        <Button size="sm" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
    </Card>
  )
}

export default function Analytics() {
  const { page, blocks, products } = usePage()
  const [range, setRange] = useState('30')
  const [custom, setCustom] = useState({ from: addDays(istToday(), -13), to: istToday() })
  const [data, setData] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tick, setTick] = useState(0)

  const { from, to } = range === 'custom' ? custom : { from: addDays(istToday(), -(Number(range) - 1)), to: istToday() }

  useEffect(() => {
    let alive = true
    setData(null)
    ;(async () => {
      if (tick === 0) await supabase.rpc('refresh_my_stats', { p_page_id: page.id })
      const [{ data: days }, { data: blockDays }, { data: productDays }, { data: orders }] = await Promise.all([
        supabase.from('page_daily').select('*').eq('page_id', page.id).gte('day', from).lte('day', to).order('day'),
        supabase.from('block_daily').select('block_id, clicks').eq('page_id', page.id).gte('day', from).lte('day', to),
        supabase.from('product_daily').select('product_id, views').eq('page_id', page.id).gte('day', from).lte('day', to),
        supabase
          .from('orders')
          .select('product_id, product_title, kind, amount_inr')
          .eq('page_id', page.id)
          .eq('status', 'paid')
          .gte('created_at', `${from}T00:00:00+05:30`)
          .lt('created_at', `${addDays(to, 1)}T00:00:00+05:30`)
          .limit(10000),
      ])
      if (alive) setData({ days: days || [], blockDays: blockDays || [], productDays: productDays || [], orders: orders || [] })
    })()
    return () => {
      alive = false
    }
  }, [page.id, from, to, tick])

  const view = useMemo(() => {
    if (!data) return null
    const byDay = Object.fromEntries(data.days.map((d) => [d.day, d]))
    const series = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      series.push({ day: d, views: byDay[d]?.views || 0, clicks: byDay[d]?.clicks || 0 })
      if (series.length > 400) break
    }
    const sum = (k) => data.days.reduce((s, d) => s + (d[k] || 0), 0)
    const views = sum('views')
    const clicks = sum('clicks')
    const perBlock = {}
    for (const r of data.blockDays) perBlock[r.block_id] = (perBlock[r.block_id] || 0) + r.clicks
    const top = Object.entries(perBlock)
      .map(([id, c]) => ({ block: blocks.find((b) => b.id === id), clicks: c }))
      .filter((x) => x.block)
      .sort((a, b) => b.clicks - a.clicks)

    // Revenue by product: paid orders in range + product page views
    const byProduct = {}
    const titleOf = (id, fallback) => products.find((p) => p.id === id)?.title || fallback || 'Deleted product'
    const row = (key, title) => (byProduct[key] ||= { key, title, views: 0, orders: 0, revenue: 0 })
    for (const o of data.orders) {
      const r = o.kind === 'tip' ? row('tip', 'Tips') : row(o.product_id || `t:${o.product_title}`, titleOf(o.product_id, o.product_title))
      r.orders += 1
      r.revenue += o.amount_inr
    }
    for (const d of data.productDays) row(d.product_id, titleOf(d.product_id)).views += d.views
    const productRows = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue || b.views - a.views)

    return {
      series, views, clicks, uniques: sum('uniques'), ctr: views ? (clicks / views) * 100 : 0, top,
      productViews: sum('product_views'),
      purchases: data.orders.filter((o) => o.kind !== 'tip').length,
      revenue: data.orders.reduce((s, o) => s + o.amount_inr, 0),
      productRows,
      sources: mergeCounts(data.days, 'sources'), devices: mergeCounts(data.days, 'devices'), browsers: mergeCounts(data.days, 'browsers'),
      mediums: mergeCounts(data.days, 'mediums'), campaigns: mergeCounts(data.days, 'campaigns'),
      regions: mergeCounts(data.days, 'regions'), cities: mergeCounts(data.days, 'cities'),
    }
  }, [data, from, to, blocks, products])

  async function refresh() {
    setRefreshing(true)
    await supabase.rpc('refresh_my_stats', { p_page_id: page.id })
    setTick((t) => t + 1)
    setRefreshing(false)
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Analytics."
        italic="What’s working."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}>
            {!refreshing && <RefreshCw className="size-4" />} Refresh
          </Button>
        }
      >
        Cookie-less, first-party stats. Days are in IST; numbers update every few minutes.
      </PageHeading>

      <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-full bg-cream p-1">
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => setRange(r.key)} className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold ${range === r.key ? 'bg-ink text-white' : 'text-ink-600'}`}>
              {r.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className="field h-10 text-sm" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From" />
            <span className="text-ink-400">→</span>
            <input type="date" className="field h-10 text-sm" value={custom.to} min={custom.from} max={istToday()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To" />
          </div>
        )}
      </Card>

      {!view ? (
        <div className="grid h-80 place-items-center"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ['Page views', formatNumber(view.views), 'bg-white'],
              ['Unique visitors (est.)', formatNumber(view.uniques), 'bg-lilac-100'],
              ['Link clicks', formatNumber(view.clicks), 'bg-lime'],
              ['Click-through rate', `${view.ctr.toFixed(1)}%`, 'bg-ink text-white'],
            ].map(([l, v, cls]) => (
              <div key={l} className={`rounded-3xl p-5 shadow-soft sm:p-6 ${cls}`}>
                <p className={`text-xs font-semibold ${cls.includes('text-white') ? 'text-white/60' : 'text-ink-500'}`}>{l}</p>
                <p className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{v}</p>
              </div>
            ))}
          </div>

          <Card className="p-4 sm:p-7">
            <div className="flex items-center justify-between px-2">
              <p className="eyebrow text-ink-500">Views & clicks</p>
              <div className="flex gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" />Views</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#9C8FF0]" />Clicks</span>
              </div>
            </div>
            <div className="mt-4 h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={view.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#15161A" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#15161A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9C8FF0" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#9C8FF0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#15161A" strokeOpacity={0.06} vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6B6E78' }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} minTickGap={24} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6B6E78' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 12px 32px -12px rgba(21,22,26,.25)', fontSize: 13 }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  />
                  <Area type="monotone" dataKey="views" name="Views" stroke="#15161A" strokeWidth={2.5} fill="url(#gv)" />
                  <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#9C8FF0" strokeWidth={2.5} fill="url(#gc)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 sm:p-7">
            <p className="eyebrow text-ink-500">Top blocks by clicks</p>
            {view.top.length === 0 ? (
              <div className="mt-5">
                <Empty icon={BarChart3} title="No clicks yet">Share your page link — clicks on links, buttons and videos show up here.</Empty>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-ink/5">
                {view.top.map(({ block, clicks }, i) => {
                  const meta = BLOCK_TYPES[block.type]
                  return (
                    <div key={block.id} className="flex items-center gap-3 py-3">
                      <span className="w-6 text-sm font-semibold text-ink-400">{i + 1}</span>
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${meta.color}`}><meta.icon size={16} className="size-4" /></span>
                      <span className="min-w-0 flex-1 truncate font-medium">{blockSummary(block)}</span>
                      <span className="text-sm text-ink-500">{view.views ? `${((clicks / view.views) * 100).toFixed(1)}% CTR` : ''}</span>
                      <span className="w-16 text-right font-display text-lg font-bold">{formatNumber(clicks)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Breakdown title="Traffic sources" rows={view.sources} color="bg-ink" />
            <Breakdown title="Devices" rows={view.devices} color="bg-[#9C8FF0]" />
            <Breakdown title="Browsers" rows={view.browsers} color="bg-lime" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Funnel
              steps={[
                { label: 'Page views', value: view.views, color: 'bg-ink' },
                { label: 'Link clicks', value: view.clicks, color: 'bg-[#9C8FF0]' },
                { label: 'Product views', value: view.productViews, color: 'bg-lilac' },
                { label: 'Purchases', value: view.purchases, color: 'bg-lime' },
              ]}
            />
            <Card className="min-w-0 p-6 sm:p-7">
              <div className="flex items-baseline justify-between gap-3">
                <p className="eyebrow text-ink-500">Revenue by product</p>
                <p className="font-display text-xl font-bold">{formatInr(view.revenue)}</p>
              </div>
              {view.productRows.length === 0 ? (
                <p className="mt-6 text-sm text-ink-400">No product views or sales in this period</p>
              ) : (
                <div className="-mx-2 mt-4">
                  <DataTable
                    bare
                    rows={view.productRows}
                    rowKey={(r) => r.key}
                    minWidth={460}
                    defaultSort={{ key: 'revenue', dir: -1 }}
                    columns={[
                      { key: 'title', label: 'Product', value: (r) => r.title, className: 'max-w-[180px] truncate' },
                      { key: 'views', label: 'Views', align: 'right', value: (r) => (r.key === 'tip' ? null : r.views), className: 'text-ink-500', render: (r) => (r.key === 'tip' ? '—' : formatNumber(r.views)) },
                      { key: 'orders', label: 'Sales', align: 'right', value: (r) => r.orders },
                      { key: 'conv', label: 'Conv.', align: 'right', value: (r) => (r.key === 'tip' || !r.views ? null : r.orders / r.views), className: 'text-ink-500', render: (r) => (r.key === 'tip' ? '—' : pct(r.orders, r.views)) },
                      { key: 'revenue', label: 'Revenue', align: 'right', value: (r) => r.revenue, className: 'font-semibold', render: (r) => formatInr(r.revenue) },
                    ]}
                  />
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown title="UTM mediums" rows={view.mediums} color="bg-[#9C8FF0]" empty="No tagged visits yet — use the link builder below" />
            <Breakdown title="UTM campaigns" rows={view.campaigns} color="bg-lime" empty="No campaigns yet" />
            <Breakdown
              title="States / regions"
              rows={view.regions}
              color="bg-ink"
              label={regionName}
              empty="No location data yet"
              note="Approximate, from the visitor’s network. No IP addresses are stored."
            />
            <Breakdown title="Cities" rows={view.cities} color="bg-[#9C8FF0]" empty="No city data yet" note="City data appears once the site runs on Vercel." />
          </div>

          <UtmBuilder username={page.username} />
        </>
      )}
    </div>
  )
}
