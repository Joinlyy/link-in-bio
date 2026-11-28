// Cross-platform publishing: LinkedIn and YouTube (Instagram has its own function).
//   User actions (signed in):  status | authorize | exchange | disconnect | publish_now
//   Cron (x-cron-secret):      publish_due   (every minute, from pg_cron)
// Secrets: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, CRON_SECRET.
// A platform whose keys are missing simply shows as "not available yet".
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const LI = { id: Deno.env.get('LINKEDIN_CLIENT_ID') ?? '', secret: Deno.env.get('LINKEDIN_CLIENT_SECRET') ?? '' }
const YT = { id: Deno.env.get('YOUTUBE_CLIENT_ID') ?? '', secret: Deno.env.get('YOUTUBE_CLIENT_SECRET') ?? '' }
const LI_VERSION = Deno.env.get('LINKEDIN_API_VERSION') ?? '202606'
const ALLOWED_REDIRECT_HOSTS = new Set(['joinlyy.com', 'www.joinlyy.com', 'localhost'])
const MAX_VIDEO_BYTES = 200 * 1024 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

type Platform = 'linkedin' | 'youtube'
type Post = {
  id: string; owner_id: string; platform: Platform; kind: 'TEXT' | 'IMAGE' | 'CAROUSEL' | 'VIDEO'; caption: string; title: string | null
  media_path: string | null; media_url: string | null; items: { path: string; url: string }[]; options: Record<string, unknown>; attempts: number
}

const configured = (p: Platform) => (p === 'linkedin' ? Boolean(LI.id && LI.secret) : Boolean(YT.id && YT.secret))
const clip = (s: unknown, n = 300) => String(s ?? '').slice(0, n)

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

Deno.serve(handle(async (req) => {
  const admin = adminClient()

  if (req.headers.get('x-cron-secret') !== null) {
    if (!CRON_SECRET || !safeEqual(req.headers.get('x-cron-secret')!, CRON_SECRET)) throw new HttpError(401, 'Unauthorized')
    const body = await req.json().catch(() => ({}))
    if (body.action !== 'publish_due') throw new HttpError(400, 'Unknown action')
    return json(await publishDue(admin))
  }

  const user = await requireUser(req, admin)
  const body = await req.json().catch(() => ({}))
  const platform = body.platform as Platform

  switch (body.action) {
    case 'status': {
      const { data } = await admin.from('social_accounts').select('platform, display_name, avatar_url, token_expires_at, connected_at').eq('owner_id', user.id)
      return json({ available: { linkedin: configured('linkedin'), youtube: configured('youtube') }, accounts: data ?? [] })
    }
    case 'authorize':
      assertPlatform(platform)
      return json({ url: await authorizeUrl(admin, user.id, platform, String(body.redirect_uri ?? '')) })
    case 'exchange':
      assertPlatform(platform)
      return json({ account: await exchange(admin, user.id, platform, String(body.code ?? ''), String(body.state ?? '')) })
    case 'disconnect': {
      assertPlatform(platform)
      const { data: tok } = await admin.from('social_tokens').select('access_token, refresh_token').eq('owner_id', user.id).eq('platform', platform).maybeSingle()
      if (platform === 'youtube' && (tok?.refresh_token || tok?.access_token)) {
        // Tell Google to forget the permission; failure doesn't matter, we delete our copy either way
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.refresh_token || tok.access_token)}`, { method: 'POST' }).catch(() => {})
      }
      await admin.from('social_tokens').delete().eq('owner_id', user.id).eq('platform', platform)
      await admin.from('social_accounts').delete().eq('owner_id', user.id).eq('platform', platform)
      await admin.from('social_posts').update({ status: 'cancelled' }).eq('owner_id', user.id).eq('platform', platform).in('status', ['scheduled', 'failed'])
      return json({ ok: true })
    }
    case 'publish_now': {
      const { data: post } = await admin.from('social_posts').select('id, status').eq('id', String(body.id ?? '')).eq('owner_id', user.id).maybeSingle()
      if (!post || !['scheduled', 'failed'].includes(post.status)) throw new HttpError(409, 'This post can not be published now')
      await admin.from('social_posts').update({ status: 'scheduled', scheduled_at: new Date().toISOString(), error: null, attempts: 0, claimed_at: null }).eq('id', post.id)
      return json({ ok: true, ...(await publishDue(admin, post.id)) })
    }
    default:
      throw new HttpError(400, 'Unknown action')
  }
}))

function assertPlatform(p: string): asserts p is Platform {
  if (p !== 'linkedin' && p !== 'youtube') throw new HttpError(400, 'Unknown platform')
  if (!configured(p)) throw new HttpError(503, `${p === 'linkedin' ? 'LinkedIn' : 'YouTube'} is not available yet. Please try again later.`)
}

// ---------------------------------------------------------------------------
// Connecting
// ---------------------------------------------------------------------------
async function authorizeUrl(admin: SupabaseClient, userId: string, platform: Platform, redirectUri: string) {
  let redirect: URL
  try {
    redirect = new URL(redirectUri)
  } catch {
    throw new HttpError(400, 'Bad redirect address')
  }
  if (!ALLOWED_REDIRECT_HOSTS.has(redirect.hostname) || redirect.pathname !== `/${platform}/callback` || (redirect.protocol !== 'https:' && redirect.hostname !== 'localhost')) {
    throw new HttpError(400, 'Bad redirect address')
  }
  const state = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
  const { error } = await admin.from('social_oauth_states').insert({ state, owner_id: userId, platform, redirect_uri: redirect.href })
  if (error) throw new HttpError(500, error.message)
  const url = new URL(platform === 'linkedin' ? 'https://www.linkedin.com/oauth/v2/authorization' : 'https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', platform === 'linkedin' ? LI.id : YT.id)
  url.searchParams.set('redirect_uri', redirect.href)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  if (platform === 'linkedin') {
    url.searchParams.set('scope', 'openid profile w_member_social')
  } else {
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
  }
  return url.toString()
}

async function exchange(admin: SupabaseClient, userId: string, platform: Platform, code: string, state: string) {
  if (!code || !state) throw new HttpError(400, 'Missing authorization code')
  const { data: st } = await admin.from('social_oauth_states').delete().eq('state', state).eq('owner_id', userId).eq('platform', platform).select().maybeSingle()
  if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) throw new HttpError(400, 'This connection link expired. Please try again.')

  const tokenUrl = platform === 'linkedin' ? 'https://www.linkedin.com/oauth/v2/accessToken' : 'https://oauth2.googleapis.com/token'
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: st.redirect_uri,
      client_id: platform === 'linkedin' ? LI.id : YT.id, client_secret: platform === 'linkedin' ? LI.secret : YT.secret,
    }),
  })
  const tok = await res.json().catch(() => ({}))
  if (!res.ok || !tok.access_token) {
    console.error(platform, 'token exchange failed', clip(JSON.stringify(tok)))
    throw new HttpError(400, `${platform === 'linkedin' ? 'LinkedIn' : 'Google'} did not accept the connection. Please try again.`)
  }
  const expiresAt = tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000).toISOString() : null

  let externalId = ''
  let name = ''
  let avatar: string | null = null
  if (platform === 'linkedin') {
    const me = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json()).catch(() => ({}))
    if (!me.sub) throw new HttpError(400, 'Could not read your LinkedIn profile. Please try again.')
    externalId = String(me.sub)
    name = String(me.name ?? '')
    avatar = me.picture ?? null
  } else {
    const ch = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json()).catch(() => ({}))
    const item = ch.items?.[0]
    if (!item) throw new HttpError(400, 'This Google account has no YouTube channel yet. Create one on YouTube and connect again.')
    externalId = String(item.id)
    name = String(item.snippet?.title ?? '')
    avatar = item.snippet?.thumbnails?.default?.url ?? null
  }

  const previous = await admin.from('social_tokens').select('refresh_token').eq('owner_id', userId).eq('platform', platform).maybeSingle()
  await admin.from('social_tokens').upsert({
    owner_id: userId, platform, access_token: tok.access_token, refresh_token: tok.refresh_token ?? previous.data?.refresh_token ?? null,
    expires_at: expiresAt, scope: tok.scope ?? null, updated_at: new Date().toISOString(),
  })
  const { data: account, error } = await admin.from('social_accounts').upsert(
    { owner_id: userId, platform, external_id: externalId, display_name: name, avatar_url: avatar, token_expires_at: expiresAt, connected_at: new Date().toISOString() },
    { onConflict: 'owner_id,platform' },
  ).select('platform, display_name, avatar_url, token_expires_at').single()
  if (error) throw new HttpError(500, error.message)
  return account
}

/** A valid access token for this creator, refreshed when it is about to expire */
async function accessToken(admin: SupabaseClient, ownerId: string, platform: Platform): Promise<string> {
  const { data: tok } = await admin.from('social_tokens').select('access_token, refresh_token, expires_at').eq('owner_id', ownerId).eq('platform', platform).maybeSingle()
  if (!tok) throw new Error(`${platform === 'linkedin' ? 'LinkedIn' : 'YouTube'} is not connected. Connect it again in Settings.`)
  const expiring = tok.expires_at && new Date(tok.expires_at).getTime() < Date.now() + 120_000
  if (!expiring) return tok.access_token
  if (platform === 'linkedin' || !tok.refresh_token) {
    throw new Error(`${platform === 'linkedin' ? 'LinkedIn' : 'YouTube'} access ended. Connect it again in Settings (LinkedIn asks every 60 days).`)
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: YT.id, client_secret: YT.secret }),
  })
  const fresh = await res.json().catch(() => ({}))
  if (!res.ok || !fresh.access_token) throw new Error('YouTube access ended. Connect it again in Settings.')
  const expiresAt = new Date(Date.now() + Number(fresh.expires_in ?? 3600) * 1000).toISOString()
  await admin.from('social_tokens').update({ access_token: fresh.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() }).eq('owner_id', ownerId).eq('platform', platform)
  await admin.from('social_accounts').update({ token_expires_at: expiresAt }).eq('owner_id', ownerId).eq('platform', platform)
  return fresh.access_token
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------
async function publishDue(admin: SupabaseClient, onlyId?: string) {
  const started = Date.now()
  const nowIso = new Date().toISOString()
  const stale = new Date(Date.now() - 10 * 60_000).toISOString()
  let q = admin.from('social_posts')
    .select('id, owner_id, platform, kind, caption, title, media_path, media_url, items, options, attempts, status')
    .lte('scheduled_at', nowIso)
    .or(`status.eq.scheduled,and(status.eq.publishing,claimed_at.lt.${stale})`)
    .order('scheduled_at').limit(5)
  if (onlyId) q = q.eq('id', onlyId)
  const { data: due } = await q
  let published = 0
  let failed = 0
  for (const post of (due ?? []) as (Post & { status: string })[]) {
    if (Date.now() - started > 120_000) break // the rest goes out next minute
    if (post.attempts >= 3) {
      await admin.from('social_posts').update({ status: 'failed', error: 'Tried three times without success. Press retry to try again.' }).eq('id', post.id)
      failed++
      continue
    }
    // Claim it: only one run publishes a given post
    const { data: claimed } = await admin.from('social_posts')
      .update({ status: 'publishing', attempts: post.attempts + 1, claimed_at: new Date().toISOString() })
      .eq('id', post.id).eq('attempts', post.attempts).select('id').maybeSingle()
    if (!claimed) continue
    try {
      const token = await accessToken(admin, post.owner_id, post.platform)
      const result = post.platform === 'linkedin' ? await publishLinkedIn(admin, token, post) : await publishYouTube(token, post)
      await admin.from('social_posts').update({
        status: 'published', external_id: result.id, permalink: result.url, published_at: new Date().toISOString(), error: null,
      }).eq('id', post.id)
      published++
      // The files stay while Instagram or another platform still needs them
      for (const path of new Set([post.media_path, ...(post.items ?? []).map((i) => i.path)].filter(Boolean) as string[])) {
        const { data: inUse } = await admin.rpc('social_media_in_use', { p_path: path })
        if (!inUse) await admin.storage.from('ig-posts').remove([path]).catch(() => {})
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('social publish failed', post.platform, post.id, message)
      await admin.from('social_posts').update({ status: 'failed', error: clip(message) }).eq('id', post.id)
      failed++
    }
  }
  return { published, failed }
}

async function download(url: string, max: number): Promise<{ bytes: Uint8Array; type: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('The uploaded file is no longer available. Upload it again.')
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > max) throw new Error(`The file is too large (${Math.round(max / 1024 / 1024)} MB at most).`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > max) throw new Error(`The file is too large (${Math.round(max / 1024 / 1024)} MB at most).`)
  return { bytes, type: res.headers.get('content-type') ?? 'application/octet-stream' }
}

// ---- LinkedIn ----
const liHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`, 'LinkedIn-Version': LI_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json',
})

async function liError(res: Response) {
  const b = await res.json().catch(() => ({}))
  if (res.status === 401) return 'LinkedIn access ended. Connect it again in Settings.'
  return `LinkedIn said no (${res.status}): ${clip(b.message || JSON.stringify(b), 200)}`
}

async function liUploadImage(token: string, owner: string, url: string): Promise<string> {
  const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST', headers: liHeaders(token), body: JSON.stringify({ initializeUploadRequest: { owner } }),
  })
  if (!init.ok) throw new Error(await liError(init))
  const { value } = await init.json()
  const file = await download(url, MAX_IMAGE_BYTES)
  const put = await fetch(value.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: file.bytes })
  if (!put.ok) throw new Error(`LinkedIn did not accept the image (${put.status}).`)
  return value.image as string
}

async function liUploadVideo(token: string, owner: string, url: string): Promise<string> {
  const file = await download(url, MAX_VIDEO_BYTES)
  const init = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
    method: 'POST', headers: liHeaders(token),
    body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: file.bytes.length, uploadCaptions: false, uploadThumbnail: false } }),
  })
  if (!init.ok) throw new Error(await liError(init))
  const { value } = await init.json()
  const etags: string[] = []
  for (const part of value.uploadInstructions as { uploadUrl: string; firstByte: number; lastByte: number }[]) {
    const put = await fetch(part.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file.bytes.slice(part.firstByte, part.lastByte + 1) })
    if (!put.ok) throw new Error(`LinkedIn did not accept the video (${put.status}).`)
    etags.push((put.headers.get('etag') ?? '').replaceAll('"', ''))
  }
  const fin = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
    method: 'POST', headers: liHeaders(token),
    body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken ?? '', uploadedPartIds: etags } }),
  })
  if (!fin.ok) throw new Error(await liError(fin))
  return value.video as string
}

async function publishLinkedIn(admin: SupabaseClient, token: string, post: Post): Promise<{ id: string; url: string }> {
  const { data: acc } = await admin.from('social_accounts').select('external_id').eq('owner_id', post.owner_id).eq('platform', 'linkedin').maybeSingle()
  if (!acc) throw new Error('LinkedIn is not connected. Connect it again in Settings.')
  const owner = `urn:li:person:${acc.external_id}`
  const body: Record<string, unknown> = {
    author: owner, commentary: post.caption, visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
  }
  if (post.kind === 'IMAGE' && post.media_url) {
    body.content = { media: { id: await liUploadImage(token, owner, post.media_url) } }
  } else if (post.kind === 'CAROUSEL') {
    const images = []
    for (const it of post.items) images.push({ id: await liUploadImage(token, owner, it.url) })
    body.content = { multiImage: { images } }
  } else if (post.kind === 'VIDEO' && post.media_url) {
    body.content = { media: { id: await liUploadVideo(token, owner, post.media_url), title: (post.title || post.caption.split('\n')[0] || 'Video').slice(0, 100) } }
  }
  const res = await fetch('https://api.linkedin.com/rest/posts', { method: 'POST', headers: liHeaders(token), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await liError(res))
  const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id') ?? ''
  return { id: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : 'https://www.linkedin.com/feed/' }
}

// ---- YouTube ----
async function publishYouTube(token: string, post: Post): Promise<{ id: string; url: string }> {
  if (!post.media_url) throw new Error('The video is no longer available. Upload it again.')
  const src = await fetch(post.media_url)
  if (!src.ok || !src.body) throw new Error('The uploaded video is no longer available. Upload it again.')
  const size = Number(src.headers.get('content-length') ?? 0)
  if (!size) throw new Error('Could not read the video size. Upload it again.')
  if (size > MAX_VIDEO_BYTES) throw new Error('The video is too large (200 MB at most).')
  const type = src.headers.get('content-type')?.startsWith('video/') ? src.headers.get('content-type')! : 'video/mp4'

  const short = post.options?.short === true
  const title = (post.title || post.caption.split('\n')[0] || 'Video').slice(0, short ? 92 : 100)
  const description = short && !/#shorts/i.test(post.caption) ? `${post.caption}\n\n#Shorts`.trim() : post.caption
  const privacy = ['public', 'unlisted', 'private'].includes(String(post.options?.privacy)) ? String(post.options.privacy) : 'public'

  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify({ snippet: { title, description, categoryId: '22' }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } }),
  })
  if (!init.ok) {
    const b = await init.json().catch(() => ({}))
    const reason = b?.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new Error('YouTube is busy today (daily upload quota reached). It will work again tomorrow; press retry then.')
    if (init.status === 401) throw new Error('YouTube access ended. Connect it again in Settings.')
    throw new Error(`YouTube said no (${init.status}): ${clip(b?.error?.message, 200)}`)
  }
  const uploadUrl = init.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube did not start the upload. Please try again.')

  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Length': String(size), 'Content-Type': type }, body: src.body })
  const done = await put.json().catch(() => ({}))
  if (!put.ok || !done.id) throw new Error(`YouTube did not accept the video (${put.status}): ${clip(done?.error?.message, 200)}`)
  return { id: String(done.id), url: short ? `https://www.youtube.com/shorts/${done.id}` : `https://www.youtube.com/watch?v=${done.id}` }
}
