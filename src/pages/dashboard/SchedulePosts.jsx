import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Film, Image as ImageIcon, ImagePlus, Images, Plus, Trash2, Type, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, invokeFunction, supabase } from '../../lib/supabase'
import { Alert, Badge, Button, Card, Empty, Spinner, Textarea, useToast, askConfirm } from '../../components/ui'
import { PageHeading } from './DashboardLayout'
import { FACEBOOK_COMING_SOON } from '../../lib/social'

const MAX_CAPTION = 2200
const MAX_VIDEO = 50 * 1024 * 1024
const MAX_PHOTOS = 10
const PLATFORMS = [
  { id: 'instagram', platform: 'instagram', label: 'Instagram', dot: 'bg-pink-500' },
  { id: 'linkedin', platform: 'linkedin', label: 'LinkedIn', dot: 'bg-sky-600' },
  { id: 'youtube', platform: 'youtube', label: 'YouTube', dot: 'bg-red-600' },
]
const PLATFORM_NAME = { instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', facebook: 'Facebook' }
const KINDS = [
  { id: 'image', label: 'Image', hint: 'One photo', icon: ImageIcon },
  { id: 'carousel', label: 'Carousel', hint: '2 to 10 photos', icon: Images },
  { id: 'reel', label: 'Reel', hint: 'One video', icon: Film },
  { id: 'text', label: 'Text', hint: FACEBOOK_COMING_SOON ? 'LinkedIn only' : 'LinkedIn, Facebook', icon: Type },
]
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

function KIND_BUTTON(kind, mode, n) {
  const now = mode === 'now'
  if (kind === 'carousel') return now ? `Post carousel now${n ? ` (${n} photos)` : ''}` : `Schedule carousel${n ? ` (${n} photos)` : ''}`
  if (kind === 'reel') return now ? 'Post Reel now' : 'Schedule Reel'
  if (kind === 'text') return now ? 'Post text now' : 'Schedule text'
  return now ? 'Post image now' : 'Schedule image'
}

export default function SchedulePosts() {
  const { user } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const [account, setAccount] = useState(undefined)
  const [posts, setPosts] = useState(null)
  const [allow, setAllow] = useState(null)
  const [connected, setConnected] = useState({}) // LinkedIn and YouTube accounts, by platform
  const [social, setSocial] = useState([])
  const [accounts, setAccounts] = useState([]) // every connected LinkedIn, YouTube and Facebook account
  const [targets, setTargets] = useState({ instagram: true, linkedin: false, youtube: false })
  const [ytTitle, setYtTitle] = useState('')
  const [ytShort, setYtShort] = useState(false)
  const [ytPrivacy, setYtPrivacy] = useState('public')
  const [sameCaption, setSameCaption] = useState(true) // one caption for every account, or one each
  const [captions, setCaptions] = useState({})
  const [sameTime, setSameTime] = useState(true) // one time for every account, or one each
  const [ats, setAts] = useState({})
  const [kind, setKind] = useState('image') // image | carousel | reel
  const [items, setItems] = useState([]) // chosen files: { id, file, preview }
  const [caption, setCaption] = useState('')
  const [mode, setMode] = useState('later')
  const [at, setAt] = useState(() => istNow(60))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: acc }, { data: list }, { data: soc }, { data: sp }] = await Promise.all([
      supabase.from('instagram_accounts').select('username, profile_picture_url').eq('owner_id', user.id).maybeSingle(),
      supabase.from('ig_scheduled_posts').select('id, media_type, media_url, items, caption, scheduled_at, status, permalink, error, published_at').eq('owner_id', user.id).order('scheduled_at', { ascending: false }).limit(60),
      supabase.from('social_accounts').select('id, platform, display_name').eq('owner_id', user.id).order('connected_at'),
      supabase.from('social_posts').select('id, platform, account_id, kind, caption, title, media_url, scheduled_at, status, permalink, error, published_at').eq('owner_id', user.id).order('scheduled_at', { ascending: false }).limit(60),
    ])
    setAccount(acc || null)
    setPosts(list || [])
    setConnected(Object.fromEntries((soc || []).slice().reverse().map((a) => [a.platform, a])))
    setAccounts(soc || [])
    setSocial(sp || [])
    supabase.rpc('my_post_allowance').then(({ data }) => setAllow(data || null))
  }, [user.id])
  useEffect(() => {
    load()
  }, [load])
  // Posts going out right now: look again shortly
  useEffect(() => {
    if (![...(posts || []), ...social].some((p) => p.status === 'publishing' || (p.status === 'scheduled' && new Date(p.scheduled_at) <= new Date()))) return
    const t = setTimeout(load, 15000)
    return () => clearTimeout(t)
  }, [posts, social, load])
  const itemsRef = useRef([])
  itemsRef.current = items
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), [])

  const makeItems = (files) => files.map((f) => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }))
  function clearItems() {
    items.forEach((i) => URL.revokeObjectURL(i.preview))
    setItems([])
  }
  const fbPages = accounts.filter((a) => a.platform === 'facebook')
  const ALL = [...PLATFORMS, ...fbPages.map((a) => ({ id: `facebook:${a.id}`, platform: 'facebook', accountId: a.id, label: a.display_name || 'Facebook Page', dot: 'bg-blue-600' }))]
  function changeKind(k) {
    if (k === kind) return
    clearItems()
    setError('')
    setKind(k)
    // A text post can only go to LinkedIn; leaving it, Instagram is the usual starting point again
    setTargets(k === 'text' ? { instagram: false, youtube: false, linkedin: !!connected.linkedin, ...(connected.linkedin || !fbPages[0] ? {} : { [`facebook:${fbPages[0].id}`]: true }) } : (t) => (kind === 'text' ? { instagram: !!account, linkedin: !account && !!connected.linkedin, youtube: false } : t))
  }
  const can = { instagram: Boolean(account) && kind !== 'text', linkedin: Boolean(connected.linkedin), youtube: Boolean(connected.youtube) && kind === 'reel' }
  const canUse = (x) => (x.platform === 'facebook' ? true : can[x.platform])
  const chosen = ALL.filter((x) => targets[x.id] && canUse(x))
  const multi = chosen.length > 1
  const split = multi && !sameCaption
  const CAP_MAX = { instagram: 2200, linkedin: 3000, youtube: 5000, facebook: 5000 }
  const captionFor = (id) => (split ? captions[id] ?? caption : caption)
  const atFor = (id) => (multi && !sameTime ? ats[id] || at : at)
  function splitCaptions() {
    // Start every account from what is already written
    setCaptions(Object.fromEntries(ALL.map((x) => [x.id, captions[x.id] ?? caption])))
    setSameCaption(false)
  }
  function splitTimes() {
    setAts(Object.fromEntries(ALL.map((x) => [x.id, ats[x.id] || at])))
    setSameTime(false)
  }
  useEffect(() => {
    // Start from what is connected: Instagram if it is, else the first other account
    if (account === undefined) return
    setTargets((t) => (t.instagram || t.linkedin || t.youtube ? { ...t, instagram: t.instagram && !!account } : { instagram: !!account, linkedin: !account && !!connected.linkedin, youtube: false }))
  }, [account, connected.linkedin])

  function pick(e) {
    const chosen = [...(e.target.files || [])]
    e.target.value = ''
    if (!chosen.length) return
    setError('')
    if (kind === 'reel') {
      const f = chosen[0]
      if (!f.type.startsWith('video/')) return setError('A Reel needs a video file (MP4).')
      if (f.size > MAX_VIDEO) return setError('Videos can be up to 50 MB.')
      clearItems()
      return setItems(makeItems([f]))
    }
    if (chosen.some((f) => !f.type.startsWith('image/'))) return setError('Choose photos (JPG or PNG). For a video, pick Reel above.')
    if (kind === 'image') {
      clearItems()
      return setItems(makeItems([chosen[0]]))
    }
    if (items.length + chosen.length > MAX_PHOTOS) return setError(`A carousel can have up to ${MAX_PHOTOS} photos.`)
    setItems((list) => [...list, ...makeItems(chosen)])
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
    if (kind !== 'text' && !items.length) return setError(kind === 'reel' ? 'Choose a video first.' : kind === 'carousel' ? 'Choose 2 to 10 photos first.' : 'Choose a photo first.')
    if (kind === 'carousel' && items.length < 2) return setError('A carousel needs at least 2 photos.')
    if (!chosen.length) return setError('Choose where to post: tick at least one account below.')
    if (kind === 'carousel' && items.length > 9 && chosen.some((c) => c.platform !== 'instagram')) return setError('LinkedIn and Facebook take up to 9 photos in one post. Remove one, or untick them.')
    for (const c of chosen) {
      if (captionFor(c.id).length > CAP_MAX[c.platform]) return setError(`The ${c.label} caption is too long (${CAP_MAX[c.platform]} characters at most).`)
      if (mode === 'later' && !(new Date(fromIst(atFor(c.id))) > new Date(Date.now() + 2 * 60000))) return setError(`Pick a time in the future${multi ? ` for ${c.label}` : ''}.`)
    }
    if (chosen.some((c) => c.platform === 'youtube') && !(ytTitle.trim() || captionFor('youtube').trim())) return setError('Add a title for YouTube.')
    setBusy(true)
    const uploaded = []
    let scheduledAny = false
    try {
      const whenOf = (id) => (mode === 'now' ? new Date().toISOString() : fromIst(atFor(id)))
      const group = crypto.randomUUID()
      // Upload once; every platform uses the same files
      let ups = []
      if (kind === 'text') {
        // nothing to upload
      } else if (kind !== 'carousel') {
        const file = items[0].file
        const isVideo = file.type.startsWith('video/')
        const up = await upload(isVideo ? file : await toJpeg(file), isVideo ? 'mp4' : 'jpg', isVideo ? 'video/mp4' : 'image/jpeg')
        uploaded.push(up.path)
        ups = [up]
      } else {
        for (const it of items) {
          const up = await upload(await toCarouselJpeg(it.file), 'jpg', 'image/jpeg')
          uploaded.push(up.path)
          ups.push(up)
        }
      }
      const isVideo = kind === 'reel'
      const ids = [] // { platform, id }
      for (const t of chosen) {
        if (t.platform === 'instagram') {
          const { data, error: err } = kind === 'carousel'
            ? await supabase.rpc('schedule_ig_carousel', { p_items: ups, p_caption: captionFor('instagram'), p_at: whenOf('instagram') })
            : await supabase.rpc('schedule_ig_post', { p_type: isVideo ? 'REELS' : 'IMAGE', p_path: ups[0].path, p_url: ups[0].url, p_caption: captionFor('instagram'), p_at: whenOf('instagram') })
          if (err) throw err
          scheduledAny = true
          ids.push({ platform: 'instagram', id: data })
        } else {
          const { data, error: err } = await supabase.rpc('schedule_social_post', {
            p_account: t.accountId ?? null, p_platform: t.platform, p_kind: kind === 'text' ? 'TEXT' : kind === 'carousel' ? 'CAROUSEL' : isVideo ? 'VIDEO' : 'IMAGE', p_caption: captionFor(t.id),
            p_title: t.platform === 'youtube' ? (ytTitle.trim() || captionFor('youtube').split('\n')[0]).slice(0, 100) : null,
            p_path: kind === 'carousel' || kind === 'text' ? null : ups[0].path, p_url: kind === 'carousel' || kind === 'text' ? null : ups[0].url, p_items: kind === 'carousel' ? ups : [],
            p_at: whenOf(t.id), p_group: group, p_options: t.platform === 'youtube' ? { short: ytShort, privacy: ytPrivacy } : {},
          })
          if (err) throw err
          scheduledAny = true
          ids.push({ platform: t.platform, id: data })
        }
      }
      clearItems()
      setCaption('')
      setCaptions({})
      setSameCaption(true)
      setSameTime(true)
      setAts({})
      setYtTitle('')
      setYtShort(false)
      setYtPrivacy('public')
      if (mode === 'now') {
        toast(`Publishing to ${chosen.map((c) => c.label).join(', ')}…`)
        for (const x of ids) {
          const r = await invokeFunction(x.platform === 'instagram' ? 'instagram' : 'social', { action: 'publish_now', id: x.id }).catch((e2) => toast(e2.message, 'error'))
          if (r?.published) toast(`Posted to ${PLATFORM_NAME[x.platform]}.`)
          else if (r?.failed) toast(`${PLATFORM_NAME[x.platform]} did not accept this post. See the reason in the list below.`, 'error')
        }
      } else toast('Scheduled. It goes out at the time you picked.')
    } catch (e2) {
      // Keep the files if some platform already has the post: it still needs them
      if (uploaded.length && !scheduledAny) await supabase.storage.from('ig-posts').remove(uploaded)
      setError(errorMessage(e2))
    } finally {
      setBusy(false)
      load()
    }
  }

  const isIg = (p) => p.platform === 'instagram'
  async function cancel(p) {
    if (!(await askConfirm({ title: 'Cancel this post?', message: `It will not be posted to ${PLATFORM_NAME[p.platform]}.`, confirmLabel: 'Cancel post' }))) return
    const { error: err } = isIg(p) ? await supabase.rpc('cancel_ig_post', { p_id: p.id }) : await supabase.rpc('cancel_social_post', { p_id: p.id })
    if (err) toast(errorMessage(err), 'error')
    load()
  }
  async function retry(p) {
    const { error: err } = isIg(p) ? await supabase.rpc('retry_ig_post', { p_id: p.id }) : await supabase.rpc('retry_social_post', { p_id: p.id })
    if (err) return toast(errorMessage(err), 'error')
    await invokeFunction(isIg(p) ? 'instagram' : 'social', { action: 'publish_now', id: p.id }).catch((e2) => toast(e2.message, 'error'))
    load()
  }
  async function postNow(p) {
    await invokeFunction(isIg(p) ? 'instagram' : 'social', { action: 'publish_now', id: p.id }).catch((e) => toast(e.message, 'error'))
    load()
  }
  // One list for every platform, newest first
  const allPosts = [
    ...(posts || []).map((p) => ({ ...p, platform: 'instagram', kindLabel: p.media_type === 'REELS' ? 'Reel' : p.media_type === 'CAROUSEL' ? 'Carousel' : 'Photo' })),
    ...social.map((p) => ({ ...p, kindLabel: p.kind === 'VIDEO' ? 'Video' : p.kind === 'CAROUSEL' ? 'Carousel' : p.kind === 'IMAGE' ? 'Photo' : 'Text', media_type: p.kind === 'VIDEO' ? 'REELS' : p.kind })),
  ].sort((x, y) => new Date(y.scheduled_at) - new Date(x.scheduled_at))

  if (account === undefined || !posts) return <div className="grid h-60 place-items-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <PageHeading title="Schedule posts." italic="Post while you sleep.">
        Choose what to post (an image, a carousel or a video), upload it, write the caption, tick where it goes (Instagram, LinkedIn, YouTube) and pick a time. Joinlyy posts it for you.
      </PageHeading>

      {!account && !connected.linkedin && !connected.youtube && !fbPages.length ? (
        <Card className="p-6">
          <Empty icon={CalendarClock} title="Connect an account first" action={<Button to="/dashboard/connections">Connect accounts</Button>}>
            Posts are published to the accounts you connect: Instagram, LinkedIn and YouTube. Facebook Pages are coming soon.
          </Empty>
        </Card>
      ) : (
        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3">
            {account?.profile_picture_url && <img src={account.profile_picture_url} alt="" className="size-10 rounded-full object-cover" />}
            <div className="min-w-0">
              <p className="text-sm text-ink-600">Posting to {[account && <b key="i">@{account.username}</b>, connected.linkedin && <b key="l">{connected.linkedin.display_name || 'LinkedIn'}</b>, connected.youtube && <b key="y">{connected.youtube.display_name || 'YouTube'}</b>, ...fbPages.map((f) => <b key={f.id}>{f.display_name}</b>)].filter(Boolean).reduce((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}</p>
              {allow && (
                <p className="text-xs text-ink-500">
                  {allow.trial_days != null && <b className="text-ink-700">{allow.trial_ends_at ? `Free trial ends ${new Date(allow.trial_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. ` : `Your ${allow.trial_days} day free trial starts with your first scheduled post. `}</b>}
                  This month: {allow.posts_this_month}{allow.posts_per_month != null && ` of ${allow.posts_per_month}`} posts{allow.videos_per_month != null && `, ${allow.videos_this_month} of ${allow.videos_per_month} videos`}. Waiting to post: {allow.waiting_mb} of {allow.cap_mb} MB.{' '}
                  <a href="/dashboard/billing" className="underline">Plans</a>
                </p>
              )}
            </div>
          </div>
          <form onSubmit={submit} className="mt-5 space-y-6">
            <div>
              <p className="text-sm font-semibold">What do you want to post?</p>
              <div className={`mt-2.5 grid gap-2 sm:max-w-2xl sm:gap-3 ${connected.linkedin || fbPages.length ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`} role="radiogroup" aria-label="Post type">
                {KINDS.filter((k) => k.id !== 'text' || connected.linkedin || fbPages.length).map((k) => (
                  <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => changeKind(k.id)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3.5 text-center transition sm:py-4 ${kind === k.id ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-white hover:border-ink/30'}`}>
                    <k.icon className="size-6" />
                    <span className="text-sm font-bold">{k.label}</span>
                    <span className={`text-[11px] ${kind === k.id ? 'text-white/70' : 'text-ink-500'}`}>{k.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={kind === 'carousel' || kind === 'text' ? 'space-y-6' : 'grid gap-6 lg:grid-cols-[260px_1fr]'}>
              {kind !== 'text' && <div className="min-w-0">
                <input ref={fileRef} type="file" multiple={kind === 'carousel'} accept={kind === 'reel' ? 'video/mp4,video/quicktime' : 'image/*'} className="sr-only" onChange={pick} />

                {kind === 'carousel' ? (
                  <>
                    <p className="text-sm font-semibold">Your photos <span className="font-normal text-ink-500">({items.length} of {MAX_PHOTOS}), in the order people will swipe</span></p>
                    <div className="-mx-1 mt-2.5 flex gap-3 overflow-x-auto px-1 pb-2">
                      {items.map((it, i) => (
                        <div key={it.id} className="relative aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-2xl bg-cream ring-1 ring-ink/10 sm:w-44">
                          <img src={it.preview} alt="" className="size-full object-contain" />
                          <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">{i + 1}</span>
                          <button type="button" onClick={() => removeItem(it.id)} aria-label="Remove" className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow"><X className="size-4" /></button>
                          <div className="absolute inset-x-2 bottom-2 flex justify-between">
                            <button type="button" onClick={() => moveItem(it.id, -1)} disabled={i === 0} aria-label="Move earlier" className="grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow disabled:opacity-30"><ChevronLeft className="size-4" /></button>
                            <button type="button" onClick={() => moveItem(it.id, 1)} disabled={i === items.length - 1} aria-label="Move later" className="grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow disabled:opacity-30"><ChevronRight className="size-4" /></button>
                          </div>
                        </div>
                      ))}
                      {items.length < MAX_PHOTOS && (
                        <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-[4/5] w-36 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-ink/20 bg-cream text-ink-500 hover:border-ink/40 sm:w-44">
                          <span className="flex flex-col items-center gap-1.5 px-2 text-center text-sm font-semibold"><Plus className="size-6" />{items.length ? 'Add more photos' : 'Choose photos'}</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">Each photo is fitted into a 4:5 frame without cropping.</p>
                  </>
                ) : items.length === 0 ? (
                  <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-ink/20 bg-cream text-ink-500 transition hover:border-ink/40">
                    <span className="flex flex-col items-center gap-2 px-4 text-center text-sm font-medium">
                      {kind === 'reel' ? <Film className="size-7" /> : <ImagePlus className="size-7" />}
                      {kind === 'reel' ? 'Choose a video for your Reel' : 'Choose a photo'}
                    </span>
                  </button>
                ) : (
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-cream ring-1 ring-ink/10">
                    {kind === 'reel' ? <video src={items[0].preview} className="size-full object-cover" controls muted playsInline /> : <img src={items[0].preview} alt="" className="size-full object-contain" />}
                    <button type="button" onClick={clearItems} aria-label="Remove" className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow"><X className="size-4" /></button>
                    <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold text-ink shadow">Change</button>
                  </div>
                )}
                {kind !== 'carousel' && <p className="mt-2 text-xs text-ink-500">{kind === 'reel' ? 'MP4 video, up to 50 MB.' : 'Fitted to Instagram’s shapes, with white bars if needed.'}</p>}
                <p className="mt-1 text-xs text-ink-500">Your files are kept only until the post is published, then deleted.</p>
              </div>}

              <div className="space-y-5">
                {!split && (
                  <div>
                    <Textarea label={multi ? 'Caption (same on every account)' : 'Caption'} rows={kind === 'carousel' ? 4 : 6} maxLength={chosen.some((c) => c.platform === 'instagram') || !chosen.length ? MAX_CAPTION : 3000} placeholder="Write your caption, hashtags included" value={caption} onChange={(e) => setCaption(e.target.value)} />
                  </div>
                )}
                {split && (
                  <div className="space-y-4">
                    {chosen.map((c) => (
                      <div key={c.id}>
                        <Textarea label={`${c.label} caption`} rows={4} maxLength={CAP_MAX[c.platform]} placeholder={`Caption for ${c.label}`} value={captions[c.id] ?? ''} onChange={(e) => setCaptions((m) => ({ ...m, [c.id]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">Post to</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {ALL.map((pf) => {
                      const ok = pf.platform === 'youtube' ? Boolean(connected.youtube) : canUse(pf)
                      const hidden = pf.platform === 'youtube' && kind !== 'reel'
                      if (hidden) return null
                      return ok ? (
                        <button key={pf.id} type="button" role="checkbox" aria-checked={!!targets[pf.id]} onClick={() => setTargets((t) => ({ ...t, [pf.id]: !t[pf.id] }))}
                          className={`inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition ${targets[pf.id] ? 'border-ink bg-ink text-white' : 'border-ink/10 bg-white hover:border-ink/30'}`}>
                          <span className={`size-2.5 rounded-full ${pf.dot}`} />{pf.label}
                        </button>
                      ) : (
                        <Link key={pf.id} to="/dashboard/connections" className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-dashed border-ink/20 px-4 text-sm font-semibold text-ink-500 hover:border-ink/40">
                          <Plus className="size-4" />Connect {pf.label}
                        </Link>
                      )
                    })}
                  </div>
                  {multi && (
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="size-4 accent-ink" checked={!sameCaption} onChange={(e) => (e.target.checked ? splitCaptions() : setSameCaption(true))} />
                        <span>Write a different caption for each account</span>
                      </label>
                      {mode === 'later' && (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="size-4 accent-ink" checked={!sameTime} onChange={(e) => (e.target.checked ? splitTimes() : setSameTime(true))} />
                          <span>Pick a different time for each account</span>
                        </label>
                      )}
                    </div>
                  )}
                  {!fbPages.length && !FACEBOOK_COMING_SOON && (
                    <div className="mt-2"><Link to="/dashboard/connections" className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-dashed border-ink/20 px-4 text-sm font-semibold text-ink-500 hover:border-ink/40"><Plus className="size-4" />Connect Facebook</Link></div>
                  )}
                  {targets.youtube && can.youtube && (
                    <div className="mt-4 space-y-3 rounded-2xl bg-cream p-4">
                      <div>
                        <label htmlFor="yt-title" className="block text-sm font-semibold">YouTube title</label>
                        <input id="yt-title" className="field mt-2" maxLength={100} placeholder="A clear title people would search for" value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} />
                        <p className="mt-1 text-right text-xs text-ink-500">{ytTitle.length} / 100</p>
                      </div>
                      <div>
                        <label htmlFor="yt-privacy" className="block text-sm font-semibold">Who can watch</label>
                        <select id="yt-privacy" className="field mt-2 max-w-xs" value={ytPrivacy} onChange={(e) => setYtPrivacy(e.target.value)}>
                          <option value="public">Public</option>
                          <option value="unlisted">Unlisted (only people with the link)</option>
                          <option value="private">Private (only you)</option>
                        </select>
                      </div>
                      <label className="flex items-start gap-2.5 text-sm">
                        <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={ytShort} onChange={(e) => setYtShort(e.target.checked)} />
                        <span>Post as a YouTube Short <span className="text-ink-500">(vertical video up to 60 seconds)</span></span>
                      </label>
                    </div>
                  )}
                </div>
                <div className="flex w-fit gap-1 rounded-full bg-cream p-1">
                  {[['later', 'Schedule'], ['now', 'Post now']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setMode(v)} className={`h-9 rounded-full px-4 text-sm font-semibold ${mode === v ? 'bg-ink text-white' : 'text-ink-600'}`}>{l}</button>
                  ))}
                </div>
                {mode === 'later' && (multi && !sameTime ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {chosen.map((c) => (
                      <div key={c.id}>
                        <label htmlFor={`when-${c.id}`} className="block text-sm font-semibold">{c.label}: when (India time)</label>
                        <input id={`when-${c.id}`} type="datetime-local" className="field mt-3" min={istNow(5)} value={ats[c.id] || at} onChange={(e) => setAts((m) => ({ ...m, [c.id]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <label htmlFor="post-when" className="block text-sm font-semibold">When (India time)</label>
                    <input id="post-when" type="datetime-local" className="field mt-3 max-w-xs" min={istNow(5)} value={at} onChange={(e) => { setAt(e.target.value) }} />
                  </div>
                ))}
                {error && <Alert>{error}</Alert>}
                <Button type="submit" loading={busy}>{KIND_BUTTON(kind, mode, items.length)}{chosen.length > 1 ? ` to ${chosen.length} accounts` : ''}</Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">Your posts</h2>
        {allPosts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Scheduled and posted items appear here.</p>
        ) : (
          <div className="mt-3 divide-y divide-ink/5">
            {allPosts.map((p) => (
              <div key={`${p.platform}-${p.id}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-cream">
                  {p.media_type !== 'REELS' && p.media_url ? <img src={p.media_url} alt="" className="size-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <span className="grid size-full place-items-center px-1 text-center text-xs font-semibold text-ink-500">{p.kindLabel}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{p.title || p.caption || <span className="text-ink-500">No caption</span>}</p>
                  <p className="mt-1 text-xs text-ink-500">{p.status === 'published' && p.published_at ? `Posted ${when(p.published_at)}` : `${p.status === 'cancelled' ? 'Was for' : 'For'} ${when(p.scheduled_at)}`} IST</p>
                  {p.status === 'failed' && p.error && <p className="mt-1 text-xs text-red-700">{p.error}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{PLATFORM_NAME[p.platform]}{p.platform === 'facebook' && accounts.find((a) => a.id === p.account_id) ? `: ${accounts.find((a) => a.id === p.account_id).display_name}` : ''}{p.kindLabel === 'Carousel' ? ' carousel' : ''}</Badge>
                  <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge>
                  {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2">View <ExternalLink className="size-3.5" /></a>}
                  {p.status === 'scheduled' && <Button size="sm" variant="outline" onClick={() => postNow(p)}>Post now</Button>}
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
