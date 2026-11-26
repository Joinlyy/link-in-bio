import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, invokeFunction, supabase } from '../../lib/supabase'
import { Alert, Badge, Button, Card, Empty, Spinner, Textarea, useToast, askConfirm } from '../../components/ui'
import { PageHeading } from './DashboardLayout'

const MAX_CAPTION = 2200
const MAX_VIDEO = 50 * 1024 * 1024
const TONE = { scheduled: 'lilac', publishing: 'lilac', published: 'green', failed: 'red', cancelled: 'neutral' }
const LABEL = { scheduled: 'Scheduled', publishing: 'Publishing…', published: 'Posted', failed: 'Failed', cancelled: 'Cancelled' }
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

/** A datetime-local value typed in India time becomes a real moment */
const fromIst = (v) => (v ? new Date(`${v}:00+05:30`).toISOString() : null)
function istNow(plusMinutes = 60) {
  const t = new Date(Date.now() + plusMinutes * 60000 + 5.5 * 3600000)
  return t.toISOString().slice(0, 16)
}

/**
 * Instagram only takes JPEG photos with a width to height ratio between 4:5 and 1.91:1.
 * Convert whatever was chosen, keep it under 1440 px wide, and add white bars (nothing is cropped) when the shape is outside that range.
 */
async function toJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1440 / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  let cw = w
  let ch = h
  if (w / h < 0.8) cw = Math.round(h * 0.8)
  else if (w / h > 1.91) ch = Math.round(w / 1.91)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(bitmap, Math.round((cw - w) / 2), Math.round((ch - h) / 2), w, h)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', 0.9))
}

export default function SchedulePosts() {
  const { user } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const [account, setAccount] = useState(undefined)
  const [posts, setPosts] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [mode, setMode] = useState('later')
  const [at, setAt] = useState(() => istNow(60))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: acc }, { data: list }] = await Promise.all([
      supabase.from('instagram_accounts').select('username, profile_picture_url').eq('owner_id', user.id).maybeSingle(),
      supabase.from('ig_scheduled_posts').select('id, media_type, media_url, caption, scheduled_at, status, permalink, error, published_at').eq('owner_id', user.id).order('scheduled_at', { ascending: false }).limit(60),
    ])
    setAccount(acc || null)
    setPosts(list || [])
  }, [user.id])
  useEffect(() => {
    load()
  }, [load])
  // Posts going out right now: look again shortly
  useEffect(() => {
    if (!posts?.some((p) => p.status === 'publishing' || (p.status === 'scheduled' && new Date(p.scheduled_at) <= new Date()))) return
    const t = setTimeout(load, 15000)
    return () => clearTimeout(t)
  }, [posts, load])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setError('')
    if (f.type.startsWith('video/') && f.size > MAX_VIDEO) return setError('Videos can be up to 50 MB.')
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) return setError('Choose a photo or a video.')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!file) return setError('Choose a photo or a video first.')
    if (caption.length > MAX_CAPTION) return setError('The caption is too long.')
    if (mode === 'later' && !(new Date(fromIst(at)) > new Date(Date.now() + 2 * 60000))) return setError('Pick a time in the future.')
    setBusy(true)
    try {
      const isVideo = file.type.startsWith('video/')
      const blob = isVideo ? file : await toJpeg(file)
      const path = `${user.id}/${crypto.randomUUID()}.${isVideo ? 'mp4' : 'jpg'}`
      const { error: up } = await supabase.storage.from('ig-posts').upload(path, blob, { contentType: isVideo ? 'video/mp4' : 'image/jpeg' })
      if (up) throw up
      const { data: pub } = supabase.storage.from('ig-posts').getPublicUrl(path)
      const { data: id, error: err } = await supabase.rpc('schedule_ig_post', {
        p_type: isVideo ? 'REELS' : 'IMAGE', p_path: path, p_url: pub.publicUrl, p_caption: caption, p_at: mode === 'now' ? new Date().toISOString() : fromIst(at),
      })
      if (err) {
        await supabase.storage.from('ig-posts').remove([path])
        throw err
      }
      setFile(null)
      setPreview('')
      setCaption('')
      if (mode === 'now') {
        toast('Publishing to Instagram…')
        const r = await invokeFunction('instagram', { action: 'publish_now', id }).catch((e2) => toast(e2.message, 'error'))
        if (r?.published) toast('Posted to Instagram.')
        else if (r?.failed) toast('Instagram did not accept this post. See the reason in the list below.', 'error')
      } else toast('Scheduled. It goes out at the time you picked.')
    } catch (e2) {
      setError(errorMessage(e2))
    } finally {
      setBusy(false)
      load()
    }
  }

  async function cancel(p) {
    if (!(await askConfirm({ title: 'Cancel this post?', message: 'It will not be posted to Instagram.', confirmLabel: 'Cancel post' }))) return
    const { error: err } = await supabase.rpc('cancel_ig_post', { p_id: p.id })
    if (err) toast(errorMessage(err), 'error')
    load()
  }
  async function retry(p) {
    const { error: err } = await supabase.rpc('retry_ig_post', { p_id: p.id })
    if (err) return toast(errorMessage(err), 'error')
    await invokeFunction('instagram', { action: 'publish_now', id: p.id }).catch((e2) => toast(e2.message, 'error'))
    load()
  }

  if (account === undefined || !posts) return <div className="grid h-60 place-items-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <PageHeading title="Schedule posts." italic="Post while you sleep.">
        Upload a photo or a Reel, write the caption and pick a time. Joinlyy posts it to your Instagram account for you.
      </PageHeading>

      {!account ? (
        <Card className="p-6">
          <Empty icon={CalendarClock} title="Connect Instagram first" action={<Button to="/dashboard/settings">Open Settings</Button>}>
            Posts are published to the Instagram professional account you connect in Settings.
          </Empty>
        </Card>
      ) : (
        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3">
            {account.profile_picture_url && <img src={account.profile_picture_url} alt="" className="size-10 rounded-full object-cover" />}
            <p className="text-sm text-ink-600">Posting to <b>@{account.username}</b></p>
          </div>
          <form onSubmit={submit} className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-ink/20 bg-cream text-ink-500 transition hover:border-ink/40">
                {preview ? (
                  file?.type.startsWith('video/') ? <video src={preview} className="size-full object-cover" muted playsInline /> : <img src={preview} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 px-4 text-center text-sm font-medium"><ImagePlus className="size-7" />Choose a photo or a video</span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" className="sr-only" onChange={pick} />
              <p className="mt-2 text-xs text-ink-500">Your file is kept only until the post is published, then deleted. Photos are saved as JPEG and fitted to Instagram’s shapes (white bars are added if needed). Videos become Reels: MP4, up to 50 MB.</p>
            </div>
            <div className="space-y-4">
              <div>
                <Textarea label="Caption" rows={6} maxLength={MAX_CAPTION} placeholder="Write your caption, hashtags included" value={caption} onChange={(e) => setCaption(e.target.value)} />
                <p className="mt-1 text-right text-xs text-ink-500">{caption.length} / {MAX_CAPTION}</p>
              </div>
              <div className="flex w-fit gap-1 rounded-full bg-cream p-1">
                {[['later', 'Schedule'], ['now', 'Post now']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setMode(v)} className={`h-9 rounded-full px-4 text-sm font-semibold ${mode === v ? 'bg-ink text-white' : 'text-ink-600'}`}>{l}</button>
                ))}
              </div>
              {mode === 'later' && (
                <label className="block text-sm font-medium">
                  When (India time)
                  <input type="datetime-local" className="field mt-1.5 max-w-xs" min={istNow(5)} value={at} onChange={(e) => setAt(e.target.value)} />
                </label>
              )}
              {error && <Alert>{error}</Alert>}
              <Button type="submit" loading={busy}>{mode === 'now' ? 'Post to Instagram now' : 'Schedule post'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">Your posts</h2>
        {posts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Scheduled and posted items appear here.</p>
        ) : (
          <div className="mt-3 divide-y divide-ink/5">
            {posts.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-cream">
                  {p.media_type === 'IMAGE' && p.media_url ? <img src={p.media_url} alt="" className="size-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <span className="grid size-full place-items-center text-xs font-semibold text-ink-500">{p.media_type === 'REELS' ? 'Reel' : 'Photo'}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{p.caption || <span className="text-ink-500">No caption</span>}</p>
                  <p className="mt-1 text-xs text-ink-500">{p.status === 'published' && p.published_at ? `Posted ${when(p.published_at)}` : `${p.status === 'cancelled' ? 'Was for' : 'For'} ${when(p.scheduled_at)}`} IST</p>
                  {p.status === 'failed' && p.error && <p className="mt-1 text-xs text-red-700">{p.error}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge>
                  {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2">View <ExternalLink className="size-3.5" /></a>}
                  {p.status === 'scheduled' && <Button size="sm" variant="outline" onClick={async () => { await invokeFunction('instagram', { action: 'publish_now', id: p.id }).catch((e) => toast(e.message, 'error')); load() }}>Post now</Button>}
                  {p.status === 'failed' && <Button size="sm" variant="outline" onClick={() => retry(p)}>Try again</Button>}
                  {['scheduled', 'failed'].includes(p.status) && <Button size="sm" variant="ghost" onClick={() => cancel(p)} aria-label="Cancel post"><Trash2 className="size-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
