import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, invokeFunction, supabase } from '../../lib/supabase'
import { Alert, Badge, Button, Card, Empty, Spinner, Textarea, useToast, askConfirm } from '../../components/ui'
import { PageHeading } from './DashboardLayout'

const MAX_CAPTION = 2200
const MAX_VIDEO = 50 * 1024 * 1024
const MAX_PHOTOS = 10
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

/** Carousel photos all share one shape: each is placed inside a 1080 x 1350 (4:5) white frame, nothing is cropped */
async function toCarouselJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const W = 1080
  const H = 1350
  const scale = Math.min(W / bitmap.width, H / bitmap.height)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(bitmap, Math.round((W - w) / 2), Math.round((H - h) / 2), w, h)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', 0.9))
}

export default function SchedulePosts() {
  const { user } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const [account, setAccount] = useState(undefined)
  const [posts, setPosts] = useState(null)
  const [allow, setAllow] = useState(null)
  const [items, setItems] = useState([]) // chosen files: { id, file, preview }
  const [caption, setCaption] = useState('')
  const [mode, setMode] = useState('later')
  const [at, setAt] = useState(() => istNow(60))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: acc }, { data: list }] = await Promise.all([
      supabase.from('instagram_accounts').select('username, profile_picture_url').eq('owner_id', user.id).maybeSingle(),
      supabase.from('ig_scheduled_posts').select('id, media_type, media_url, items, caption, scheduled_at, status, permalink, error, published_at').eq('owner_id', user.id).order('scheduled_at', { ascending: false }).limit(60),
    ])
    setAccount(acc || null)
    setPosts(list || [])
    supabase.rpc('my_post_allowance').then(({ data }) => setAllow(data || null))
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
  const itemsRef = useRef([])
  itemsRef.current = items
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), [])

  function pick(e) {
    const chosen = [...(e.target.files || [])]
    e.target.value = ''
    if (!chosen.length) return
    setError('')
    const video = chosen.find((f) => f.type.startsWith('video/'))
    if (video) {
      if (items.length || chosen.length > 1) return setError('A video is posted on its own as a Reel. Choose just one video, or only photos.')
      if (video.size > MAX_VIDEO) return setError('Videos can be up to 50 MB.')
    } else if (chosen.some((f) => !f.type.startsWith('image/'))) return setError('Choose photos or one video.')
    if (items.some((i) => i.file.type.startsWith('video/'))) return setError('Remove the video first to add photos.')
    if (items.length + chosen.length > MAX_PHOTOS) return setError(`A post can have up to ${MAX_PHOTOS} photos.`)
    setItems((list) => [...list, ...chosen.map((f) => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }))])
  }
  function removeItem(id) {
    setItems((list) => {
      const gone = list.find((i) => i.id === id)
      if (gone) URL.revokeObjectURL(gone.preview)
      return list.filter((i) => i.id !== id)
    })
  }
  function moveItem(id, dir) {
    setItems((list) => {
      const i = list.findIndex((x) => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function upload(blob, ext, type) {
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: up } = await supabase.storage.from('ig-posts').upload(path, blob, { contentType: type })
    if (up) throw up
    return { path, url: supabase.storage.from('ig-posts').getPublicUrl(path).data.publicUrl }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!items.length) return setError('Choose a photo or a video first.')
    if (items.length > 1 && items.length < 2) return setError('A multi-photo post needs at least 2 photos.')
    if (caption.length > MAX_CAPTION) return setError('The caption is too long.')
    if (mode === 'later' && !(new Date(fromIst(at)) > new Date(Date.now() + 2 * 60000))) return setError('Pick a time in the future.')
    setBusy(true)
    const uploaded = []
    try {
      const when = mode === 'now' ? new Date().toISOString() : fromIst(at)
      let id
      if (items.length === 1) {
        const file = items[0].file
        const isVideo = file.type.startsWith('video/')
        const up = await upload(isVideo ? file : await toJpeg(file), isVideo ? 'mp4' : 'jpg', isVideo ? 'video/mp4' : 'image/jpeg')
        uploaded.push(up.path)
        const { data, error: err } = await supabase.rpc('schedule_ig_post', { p_type: isVideo ? 'REELS' : 'IMAGE', p_path: up.path, p_url: up.url, p_caption: caption, p_at: when })
        if (err) throw err
        id = data
      } else {
        const ups = []
        for (const it of items) {
          const up = await upload(await toCarouselJpeg(it.file), 'jpg', 'image/jpeg')
          uploaded.push(up.path)
          ups.push(up)
        }
        const { data, error: err } = await supabase.rpc('schedule_ig_carousel', { p_items: ups, p_caption: caption, p_at: when })
        if (err) throw err
        id = data
      }
      items.forEach((i) => URL.revokeObjectURL(i.preview))
      setItems([])
      setCaption('')
      if (mode === 'now') {
        toast('Publishing to Instagram…')
        const r = await invokeFunction('instagram', { action: 'publish_now', id }).catch((e2) => toast(e2.message, 'error'))
        if (r?.published) toast('Posted to Instagram.')
        else if (r?.failed) toast('Instagram did not accept this post. See the reason in the list below.', 'error')
      } else toast('Scheduled. It goes out at the time you picked.')
    } catch (e2) {
      if (uploaded.length) await supabase.storage.from('ig-posts').remove(uploaded)
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
        Upload photos (up to 10 for a carousel) or a Reel, write the caption and pick a time. Joinlyy posts it to your Instagram account for you.
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
            <div className="min-w-0">
              <p className="text-sm text-ink-600">Posting to <b>@{account.username}</b></p>
              {allow && <p className="text-xs text-ink-500">Today: {allow.posts_today} of {allow.posts_per_day} post{allow.posts_per_day === 1 ? '' : 's'} · This month: {allow.reels_this_month} of {allow.reels_per_month} Reels. <a href="/dashboard/billing" className="underline">Plans</a></p>}
            </div>
          </div>
          <form onSubmit={submit} className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
            <div>
              {items.length === 0 ? (
                <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-ink/20 bg-cream text-ink-500 transition hover:border-ink/40">
                  <span className="flex flex-col items-center gap-2 px-4 text-center text-sm font-medium"><ImagePlus className="size-7" />Choose photos or a video</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((it, i) => (
                    <div key={it.id} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream">
                      {it.file.type.startsWith('video/') ? <video src={it.preview} className="size-full object-cover" muted playsInline /> : <img src={it.preview} alt="" className="size-full object-contain" />}
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">{i + 1}</span>
                      <button type="button" onClick={() => removeItem(it.id)} aria-label="Remove" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow"><X className="size-4" /></button>
                      {items.length > 1 && (
                        <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                          <button type="button" onClick={() => moveItem(it.id, -1)} disabled={i === 0} aria-label="Move earlier" className="grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow disabled:opacity-30"><ChevronLeft className="size-4" /></button>
                          <button type="button" onClick={() => moveItem(it.id, 1)} disabled={i === items.length - 1} aria-label="Move later" className="grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow disabled:opacity-30"><ChevronRight className="size-4" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length < MAX_PHOTOS && !items[0].file.type.startsWith('video/') && (
                    <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-[4/5] place-items-center rounded-2xl border-2 border-dashed border-ink/20 bg-cream text-ink-500 hover:border-ink/40">
                      <span className="flex flex-col items-center gap-1 text-xs font-semibold"><Plus className="size-5" />Add photo</span>
                    </button>
                  )}
                </div>
              )}
              <input ref={fileRef} type="file" multiple accept="image/*,video/mp4,video/quicktime" className="sr-only" onChange={pick} />
              <p className="mt-2 text-xs text-ink-500">
                {items.length > 1 ? `${items.length} photos: a swipeable carousel, up to ${MAX_PHOTOS}. Each is fitted into a 4:5 frame without cropping. ` : `Choose 2 to ${MAX_PHOTOS} photos for a carousel, one photo, or one video (a Reel, MP4 up to 50 MB). `}
                Your files are kept only until the post is published, then deleted.
              </p>
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
              <Button type="submit" loading={busy}>{items.length > 1 ? (mode === 'now' ? `Post ${items.length} photos now` : `Schedule ${items.length}-photo post`) : mode === 'now' ? 'Post to Instagram now' : 'Schedule post'}</Button>
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
                  {p.media_type !== 'REELS' && p.media_url ? <img src={p.media_url} alt="" className="size-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <span className="grid size-full place-items-center px-1 text-center text-xs font-semibold text-ink-500">{p.media_type === 'REELS' ? 'Reel' : p.media_type === 'CAROUSEL' ? 'Photos' : 'Photo'}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{p.caption || <span className="text-ink-500">No caption</span>}</p>
                  <p className="mt-1 text-xs text-ink-500">{p.status === 'published' && p.published_at ? `Posted ${when(p.published_at)}` : `${p.status === 'cancelled' ? 'Was for' : 'For'} ${when(p.scheduled_at)}`} IST</p>
                  {p.status === 'failed' && p.error && <p className="mt-1 text-xs text-red-700">{p.error}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.media_type === 'CAROUSEL' && <Badge>Carousel</Badge>}
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
