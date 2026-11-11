import { useEffect, useState } from 'react'
import { Award, Check, Copy, Gift, Medal, Trophy, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { AMBASSADOR_TIERS, ambassadorTier, referralLink } from '../../lib/referral'
import { APP_NAME } from '../../lib/config'
import { Alert, Badge, Button, Card, Empty, Spinner, Stats } from '../../components/ui'
import { WhatsappIcon } from '../../components/icons'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

function TierBadge({ tier, size = 'md' }) {
  if (!tier) return null
  const s = size === 'lg' ? 'size-14' : 'size-8'
  return (
    <span className={`grid ${s} shrink-0 place-items-center rounded-full ring-4 ring-white`} style={{ background: tier.color }} title={`${tier.name} ambassador`}>
      <Award className={size === 'lg' ? 'size-7 text-white' : 'size-4 text-white'} />
    </span>
  )
}

export default function Referrals() {
  const [stats, setStats] = useState(null)
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [boardView, setBoardView] = useViewMode('referral-board')
  const [recentView, setRecentView] = useViewMode('referral-recent')

  useEffect(() => {
    supabase.rpc('referral_stats').then(({ data, error: err }) => (err ? setError(err.message) : setStats(data)))
    supabase.rpc('referral_leaderboard').then(({ data }) => setBoard(data || []))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!stats) return <div className="grid h-80 place-items-center"><Spinner /></div>

  const link = referralLink(stats.code)
  const progress = (stats.credits || 0) % 3
  const tier = ambassadorTier(stats.published || 0)
  const nextTier = AMBASSADOR_TIERS.find((t) => (stats.published || 0) < t.min)
  const shareText = `I build my link-in-bio page on ${APP_NAME} — sell products, collect leads & track clicks, made for Indian creators. Start free: ${link}`

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Refer & earn." italic="Free Pro, on us.">
        Every 3 creators you invite who publish their page earns you 1 month of Pro.
      </PageHeading>

      <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-9">
        <div className="absolute -top-20 -right-20 size-56 rounded-full bg-lilac" aria-hidden />
        <div className="relative">
          <p className="eyebrow text-lime">Your referral link</p>
          <p className="mt-3 font-display text-xl font-bold tracking-tight break-all sm:text-3xl">{link.replace(/^https?:\/\//, '')}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="lime" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" variant="outline" className="!border-white/20 !bg-white/10 !text-white">
              <WhatsappIcon size={16} /> Share on WhatsApp
            </Button>
          </div>
        </div>
      </div>

      <Stats
        items={[
          ['Sign-ups', stats.signups ?? 0, 'bg-white'],
          ['Published', stats.published ?? 0, 'bg-lilac-100'],
          ['Credits earned', stats.credits ?? 0, 'bg-lime'],
          ['Leaderboard rank', stats.published ? `#${stats.rank}` : '—', 'bg-white'],
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 sm:p-8">
          <p className="eyebrow text-ink-500">Next reward</p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
            {3 - progress} more published creator{3 - progress === 1 ? '' : 's'} → 1 month Pro
          </h2>
          <div className="mt-5 flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`grid h-14 flex-1 place-items-center rounded-2xl ${i < progress ? 'bg-ink text-lime' : 'bg-cream text-ink-400'}`}>
                {i < progress ? <Check className="size-5" strokeWidth={3} /> : <UserPlus className="size-5" />}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-500">Credits count when a creator you referred publishes their first page. Rewards stack on top of an active Pro plan.</p>
        </Card>

        <Card className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-ink-500">Ambassador programme</p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">{tier ? `${tier.name} ambassador` : 'Not an ambassador yet'}</h2>
              <p className="mt-1 text-sm text-ink-500">
                {nextTier ? `${nextTier.min - (stats.published || 0)} more published referrals to reach ${nextTier.name}.` : 'You’ve reached the top tier. Legend.'}
              </p>
            </div>
            {tier ? <TierBadge tier={tier} size="lg" /> : <Medal className="size-10 shrink-0 text-ink-400" />}
          </div>
          <ul className="mt-5 space-y-2">
            {AMBASSADOR_TIERS.map((t) => {
              const reached = (stats.published || 0) >= t.min
              return (
                <li key={t.id} className={`flex items-center gap-3 rounded-2xl p-3 ${reached ? 'bg-cream' : ''}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: reached ? t.color : '#E3E0D6' }}>
                    <Award className="size-4 text-white" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">{t.name}</span>
                  <span className="text-sm text-ink-500">{t.min}+ published</span>
                  {reached && <Check className="size-4" strokeWidth={3} />}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow flex items-center gap-2 text-ink-500"><Trophy className="size-4" /> Top referrers</p>
            {board?.length > 0 && <ViewToggle value={boardView} onChange={setBoardView} />}
          </div>
          {board === null ? (
            <div className="grid h-24 place-items-center"><Spinner /></div>
          ) : board.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No one on the board yet — be the first!</p>
          ) : boardView === 'table' ? (
            <div className="mt-4">
              <DataTable
                bare
                rows={board.map((r, i) => ({ ...r, rank: i + 1 }))}
                rowKey={(r) => `${r.username || r.name}-${r.rank}`}
                minWidth={380}
                columns={[
                  { key: 'name', label: 'Creator', value: (r) => r.name, className: 'truncate' },
                  { key: 'rank', label: 'Rank', align: 'right', value: (r) => r.rank },
                  { key: 'referrals', label: 'Referrals', align: 'right', value: (r) => Number(r.referrals) },
                ]}
              />
            </div>
          ) : (
            <ol className="mt-4 space-y-1">
              {board.map((r, i) => (
                <li key={`${r.username || r.name}-${i}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-cream">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i < 3 ? 'bg-lime' : 'bg-cream'}`}>{i + 1}</span>
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lilac-100 text-sm font-bold">{(r.name || '?')[0]}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    {r.username && <a href={`/${r.username}`} target="_blank" rel="noreferrer" className="block truncate text-xs text-ink-500 hover:underline">/{r.username}</a>}
                  </span>
                  <TierBadge tier={ambassadorTier(Number(r.referrals))} />
                  <span className="shrink-0 font-display text-lg font-bold">{r.referrals}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow text-ink-500">Recent referrals</p>
            {stats.recent?.length > 0 && <ViewToggle value={recentView} onChange={setRecentView} />}
          </div>
          {!stats.recent?.length ? (
            <div className="mt-4">
              <Empty icon={Gift} title="No referrals yet">Share your link in your stories, WhatsApp groups or creator communities.</Empty>
            </div>
          ) : recentView === 'table' ? (
            <div className="mt-3">
              <DataTable
                bare
                rows={stats.recent.map((r, i) => ({ ...r, number: stats.recent.length - i }))}
                rowKey={(r) => r.number}
                minWidth={380}
                columns={[
                  { key: 'number', label: 'Creator', value: (r) => r.number, render: (r) => `Creator #${r.number}` },
                  { key: 'joined', label: 'Joined', value: (r) => r.joined, className: 'whitespace-nowrap text-ink-500', render: (r) => new Date(r.joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
                  { key: 'published', label: 'Status', value: (r) => (r.published ? 'Published' : 'Setting up'), render: (r) => (r.published ? <Badge tone="green">Published</Badge> : <Badge>Setting up</Badge>) },
                ]}
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-ink/5">
              {stats.recent.map((r, i) => (
                <li key={`${r.joined}-${i}`} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm">
                    <span className="font-semibold">Creator #{stats.recent.length - i}</span>
                    <span className="text-ink-500"> · joined {new Date(r.joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </span>
                  {r.published ? <Badge tone="green">Published</Badge> : <Badge>Setting up</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
