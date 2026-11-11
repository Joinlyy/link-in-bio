import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { ArrowUpRight, Check, Download, Share2 } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { pageDisplayUrl, pageUrl, INSTAGRAM_ENABLED } from '../../lib/config'
import { formatNumber } from '../../lib/embeds'
import { Button, Card } from '../../components/ui'
import { InstagramIcon } from '../../components/icons'
import { PageHeading } from './DashboardLayout'
import Milestones from '../../components/Milestones'
import { clearRef, storedRef } from '../../lib/referral'

function istDate(offsetDays = 0) {
  const d = new Date(Date.now() + 5.5 * 3600_000 - offsetDays * 86400_000)
  return d.toISOString().slice(0, 10)
}

export function useWeekStats(pageId) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      await supabase.rpc('refresh_my_stats', { p_page_id: pageId })
      const since = istDate(6)
      const [{ data: days }, { count: leads }] = await Promise.all([
        supabase.from('page_daily').select('day, views, uniques, clicks').eq('page_id', pageId).gte('day', since).order('day'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('page_id', pageId).gte('created_at', `${since}T00:00:00+05:30`),
      ])
      if (!alive) return
      const sum = (k) => (days || []).reduce((s, d) => s + d[k], 0)
      const series = Array.from({ length: 7 }, (_, i) => {
        const day = istDate(6 - i)
        return { day, views: days?.find((d) => d.day === day)?.views || 0 }
      })
      setStats({ views: sum('views'), uniques: sum('uniques'), clicks: sum('clicks'), leads: leads || 0, series })
    })()
    return () => {
      alive = false
    }
  }, [pageId])
  return stats
}

function QrCard({ username }) {
  const ref = useRef(null)
  function download() {
    const canvas = ref.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `${username}-qr.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }
  return (
    <Card className="flex flex-col items-center p-6 text-center sm:p-7">
      <p className="eyebrow self-start text-ink-500">Your QR code</p>
      <div ref={ref} className="mt-5 rounded-3xl bg-cream p-4">
        <QRCodeCanvas value={`${pageUrl(username)}?utm_source=qr`} size={512} level="M" fgColor="#15161A" bgColor="#F2F1EC" style={{ width: 168, height: 168 }} />
      </div>
      <p className="mt-3 text-sm text-ink-500">Print it on packaging, visiting cards or event standees.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={download}>
        <Download className="size-4" /> Download PNG
      </Button>
    </Card>
  )
}

export default function Overview() {
  const { page, blocks, instagram, updatePage } = usePage()
  const { profile } = useAuth()
  const stats = useWeekStats(page.id)
  const firstName = (profile?.full_name || page.display_name || '').split(' ')[0]
  const max = Math.max(1, ...(stats?.series || []).map((s) => s.views))

  // Google sign-ups can't carry ?ref= metadata — claim it once after login
  useEffect(() => {
    const code = storedRef()
    if (!code) return
    supabase.rpc('claim_referral', { p_code: code }).then(() => clearRef())
  }, [])

  const checklist = [
    { done: !!page.avatar_url, label: 'Add a profile photo', to: '/dashboard/editor' },
    { done: !!page.bio, label: 'Write a short bio', to: '/dashboard/editor' },
    { done: !blocks.some((b) => b.data?.sample && b.type !== 'products'), label: 'Replace the examples with your own content', to: '/dashboard/editor' },
    { done: blocks.filter((b) => b.is_active).length >= 3, label: 'Add at least 3 sections', to: '/dashboard/editor' },
    ...(INSTAGRAM_ENABLED ? [{ done: !!instagram, label: 'Connect Instagram', to: '/dashboard/settings' }] : []),
    { done: page.is_published, label: 'Make your page live', action: () => updatePage({ is_published: true }, { immediate: true }) },
  ]
  const doneCount = checklist.filter((c) => c.done).length

  return (
    <div className="space-y-4">
      <PageHeading title={`Hi${firstName ? `, ${firstName}` : ''}.`} italic="Here’s your week." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Page views', value: stats?.views, cls: 'bg-white' },
          { label: 'Unique visitors', value: stats?.uniques, cls: 'bg-lilac-100' },
          { label: 'Link clicks', value: stats?.clicks, cls: 'bg-lime' },
          { label: 'New leads', value: stats?.leads, cls: 'bg-ink text-white' },
        ].map((s) => (
          <div key={s.label} className={`rounded-3xl p-6 shadow-soft ${s.cls}`}>
            <p className={`eyebrow ${s.cls.includes('text-white') ? 'text-white/60' : 'text-ink-500'}`}>{s.label}</p>
            <p className="mt-3 font-display text-4xl font-bold tracking-tight">{stats ? formatNumber(s.value) : '—'}</p>
            <p className={`mt-1 text-xs ${s.cls.includes('text-white') ? 'text-white/50' : 'text-ink-500'}`}>Last 7 days</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-ink-500">Views per day</p>
            <Link to="/dashboard/analytics" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
              Full analytics <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-8 flex h-44 items-end gap-2 sm:gap-3">
            {(stats?.series || Array.from({ length: 7 }, () => ({ views: 0 }))).map((s, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className={`w-full rounded-full transition-all ${i === 6 ? 'bg-lime' : 'bg-ink'}`} style={{ height: `${Math.max(8, (s.views / max) * 150)}px` }} title={`${s.views} views`} />
                <span className="text-[11px] text-ink-500">{s.day ? new Date(s.day).toLocaleDateString('en-IN', { weekday: 'narrow' }) : ''}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-ink-500">Get set up</p>
            <span className="text-sm font-semibold">{doneCount}/{checklist.length}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-cream">
            <div className="h-2 rounded-full bg-lime transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
          </div>
          <ul className="mt-5 space-y-1">
            {checklist.map((c) => {
              const inner = (
                <>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full ${c.done ? 'bg-ink text-lime' : 'border-2 border-ink/15'}`}>{c.done && <Check className="size-3.5" strokeWidth={3} />}</span>
                  <span className={`flex-1 text-[15px] ${c.done ? 'text-ink-400 line-through' : 'font-medium'}`}>{c.label}</span>
                  {!c.done && <ArrowUpRight className="size-4 text-ink-400" />}
                </>
              )
              const cls = 'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-cream'
              return (
                <li key={c.label}>
                  {c.to ? <Link to={c.to} className={cls}>{inner}</Link> : <button type="button" onClick={c.action} disabled={c.done} className={cls}>{inner}</button>}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr] lg:grid-cols-[1.3fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white sm:p-9">
          <div className="absolute -top-20 -right-20 size-56 rounded-full bg-lilac" aria-hidden />
          <div className="relative">
            <p className="eyebrow text-lime">Share your page</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">{pageDisplayUrl(page.username)}</h2>
            <p className="mt-3 max-w-md text-[15px] text-white/70">Paste this in your Instagram bio, YouTube description and WhatsApp status.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="lime" onClick={() => navigator.clipboard.writeText(pageUrl(page.username))}>
                <Share2 className="size-4" /> Copy link
              </Button>
              <Button href="https://www.instagram.com/accounts/edit/" target="_blank" rel="noreferrer" variant="outline" className="!border-white/20 !bg-white/10 !text-white">
                <InstagramIcon size={16} /> Open Instagram bio
              </Button>
            </div>
          </div>
        </div>
        <QrCard username={page.username} />
      </div>

      <Milestones page={page} name={page.display_name || profile?.full_name || ''} />
    </div>
  )
}
