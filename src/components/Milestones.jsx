import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, PartyPopper, Share2, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatNumber } from '../lib/embeds'
import { celebratedIds, drawMilestoneCard, evaluateMilestones, markCelebrated } from '../lib/milestones'
import { Button, Card, Modal, Spinner } from './ui'

function CelebrateModal({ milestone, name, username, onClose }) {
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!milestone || !canvasRef.current) return
    setReady(false)
    drawMilestoneCard(canvasRef.current, { name, username, milestone: milestone.title }).then(() => setReady(true))
  }, [milestone, name, username])

  const toBlob = () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'))
  const filename = `${username}-${milestone?.id || 'milestone'}.png`

  async function download() {
    const blob = await toBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function share() {
    const blob = await toBlob()
    const text = `Just hit ${milestone.title}! 🎉`
    try {
      const file = blob && new File([blob], filename, { type: 'image/png' })
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text })
      else await navigator.share({ text, url: `${window.location.origin}/${username}` })
    } catch {
      /* cancelled */
    }
  }

  return (
    <Modal open={!!milestone} onClose={onClose} title="Milestone unlocked! 🎉">
      <p className="text-sm text-ink-600">You just hit <b>{milestone?.title}</b>. Share the moment with your audience.</p>
      <div className="relative mt-4 overflow-hidden rounded-3xl bg-ink">
        <canvas ref={canvasRef} className="block aspect-square w-full" aria-label={`Milestone card: ${milestone?.title}`} />
        {!ready && <div className="absolute inset-0 grid place-items-center"><Spinner className="text-white" /></div>}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={download} disabled={!ready}><Download className="size-4" /> Download PNG</Button>
        {canShare && <Button onClick={share} disabled={!ready}><Share2 className="size-4" /> Share</Button>}
      </div>
    </Modal>
  )
}

/** Lifetime milestone ladder + celebration modal for the newest uncelebrated milestone */
export default function Milestones({ page, name }) {
  const [rows, setRows] = useState(null)
  const [celebrate, setCelebrate] = useState(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('page_milestones', { p_page_id: page.id }).then(({ data }) => {
      if (!alive) return
      const evaluated = evaluateMilestones(data || {})
      setRows(evaluated)
      const done = new Set(celebratedIds(page.id))
      const fresh = evaluated.flatMap((m) => m.achieved.filter((a) => !done.has(a.id)).map((a) => ({ ...a, rank: m.steps.indexOf(a.threshold) / m.steps.length })))
      if (fresh.length) setCelebrate(fresh.sort((a, b) => b.rank - a.rank)[0])
    })
    return () => {
      alive = false
    }
  }, [page.id])

  const close = useCallback(() => {
    // Mark everything already achieved as celebrated so we only pop up for new ones
    if (rows) markCelebrated(page.id, rows.flatMap((m) => m.achieved.map((a) => a.id)))
    setCelebrate(null)
  }, [rows, page.id])

  const achieved = (rows || []).flatMap((m) => m.achieved)

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-2 text-ink-500"><Trophy className="size-4" /> Milestones</p>
        {achieved.length > 0 && <span className="text-sm font-semibold">{achieved.length} unlocked</span>}
      </div>
      {rows === null ? (
        <div className="grid h-32 place-items-center"><Spinner /></div>
      ) : (
        <>
          {achieved.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {achieved.map((a) => (
                <button key={a.id} type="button" onClick={() => setCelebrate(a)} className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-xs font-semibold hover:brightness-95" title="Share this milestone">
                  <PartyPopper className="size-3.5" /> {a.title}
                </button>
              ))}
            </div>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {rows.map((m) => (
              <div key={m.metric} className="rounded-2xl bg-cream p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="font-display text-lg font-bold">{m.metric === 'earnings' ? `₹${formatNumber(m.value)}` : formatNumber(m.value)}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-ink transition-all" style={{ width: `${Math.max(2, m.progress * 100)}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-ink-500">{m.next ? `Next: ${m.format(m.next)}` : 'All milestones unlocked 🏆'}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <CelebrateModal milestone={celebrate} name={name} username={page.username} onClose={close} />
    </Card>
  )
}
