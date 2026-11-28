// Instagram connection via Instagram Business Login (no Facebook Page required).
// Calls the Instagram Graph API directly (the instagram-platform SDK has no /me helper).
//
// Secrets: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI, CRON_SECRET
// Cron (pg_cron → pg_net): POST {action:'sync_all'} with header `x-cron-secret: <CRON_SECRET>`
// refreshes stale accounts (and their tokens) without a user session.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'

const APP_ID = Deno.env.get('INSTAGRAM_APP_ID') ?? ''
const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? ''
const REDIRECT_URI = Deno.env.get('INSTAGRAM_REDIRECT_URI') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const GRAPH = 'https://graph.instagram.com'
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
  'instagram_business_manage_comments', // DM automation: read comments + reply
  'instagram_business_manage_messages', // DM automation: send DMs
  'instagram_business_content_publish', // post scheduler: publish the creator's own scheduled posts
]

Deno.serve(handle(async (req) => {
  const admin = adminClient()

  // Scheduled sync: shared secret instead of a user JWT
  const cronHeader = req.headers.get('x-cron-secret')
  if (cronHeader !== null) {
    if (!CRON_SECRET || !safeEqual(cronHeader, CRON_SECRET)) throw new HttpError(401, 'Unauthorized')
    const body = await req.json().catch(() => ({}))
    if (body.action === 'publish_due') return json(await publishDue(admin))
    if (body.action === 'purge_media') {
      const { data: old } = await admin.rpc('ig_orphan_media')
      const names = ((old ?? []) as { name: string }[]).map((o) => o.name)
      if (names.length) {
        await admin.storage.from('ig-posts').remove(names)
        // The rows keep the link, time and status; the dead file address is cleared
        await admin.from('ig_scheduled_posts').update({ media_url: '', media_path: '', items: [] }).in('media_path', names).in('status', ['published', 'cancelled', 'failed'])
      }
      return json({ ok: true, removed: names.length })
    }
    if (body.action !== 'sync_all') throw new HttpError(400, 'Unknown action')
    return json(await syncAll(admin))
  }

  const user = await requireUser(req, admin)
  const body = await req.json().catch(() => ({}))

  switch (body.action) {
    case 'authorize':
      return json({ url: await authorizeUrl(admin, user.id) })
    case 'exchange':
      return json({ account: await exchange(admin, user.id, body.code, body.state) })
    case 'sync':
      return json({ account: await sync(admin, user.id) })
    case 'publish_now': {
      // The creator pressed "Publish now" on one of their own posts that is waiting
      const { data: post } = await admin.from('ig_scheduled_posts').select('id, status').eq('id', String(body.id ?? '')).eq('owner_id', user.id).maybeSingle()
      if (!post || !['scheduled', 'failed'].includes(post.status)) throw new HttpError(409, 'This post can not be published now')
      await admin.from('ig_scheduled_posts').update({ status: 'scheduled', scheduled_at: new Date().toISOString(), error: null }).eq('id', post.id)
      return json({ ok: true, ...(await publishDue(admin, post.id)) })
    }
    case 'disconnect': {
      const { data: tok } = await admin.from('instagram_tokens').select('access_token').eq('owner_id', user.id).maybeSingle()
      if (tok?.access_token) await subscribe(tok.access_token, false)
      await admin.from('instagram_tokens').delete().eq('owner_id', user.id)
      await admin.from('instagram_accounts').delete().eq('owner_id', user.id)
      return json({ ok: true })
    }
    default:
      throw new HttpError(400, 'Unknown action')
  }
}))

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

/** Re-sync up to 50 accounts not synced in the last 20 hours (oldest first). Failures are logged and skipped. */
async function syncAll(admin: SupabaseClient) {
  const cutoff = new Date(Date.now() - 20 * 3600_000).toISOString()
  const { data: accounts, error } = await admin.from('instagram_accounts')
    .select('owner_id, username, last_synced_at')
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(50)
  if (error) throw new HttpError(500, error.message)

  let synced = 0
  const failed: { owner_id: string; error: string }[] = []
  for (const acc of accounts ?? []) {
    try {
      await sync(admin, acc.owner_id)
      synced++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`sync_all: @${acc.username ?? acc.owner_id} failed`, message)
      failed.push({ owner_id: acc.owner_id, error: message.slice(0, 200) })
    }
  }
  return { ok: true, candidates: accounts?.length ?? 0, synced, failed }
}

function assertConfigured() {
  if (!APP_ID || !APP_SECRET || !REDIRECT_URI) {
    throw new HttpError(503, 'Instagram connection is not configured yet. Please try again later.')
  }
}

async function authorizeUrl(admin: SupabaseClient, userId: string) {
  assertConfigured()
  const state = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
  const { error } = await admin.from('instagram_oauth_states').insert({ state, owner_id: userId })
  if (error) throw new HttpError(500, error.message)

  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', APP_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(','))
  url.searchParams.set('state', state)
  url.searchParams.set('enable_fb_login', '0')
  return url.toString()
}

async function exchange(admin: SupabaseClient, userId: string, code: string, state: string) {
  assertConfigured()
  if (!code || !state) throw new HttpError(400, 'Missing authorization code')

  // One-time, user-bound, short-lived state (CSRF protection)
  const { data: st } = await admin.from('instagram_oauth_states')
    .delete().eq('state', state).eq('owner_id', userId).select().maybeSingle()
  if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) {
    throw new HttpError(400, 'This connection link has expired. Please try again.')
  }

  // 1) code -> short-lived token
  const form = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code: code.replace(/#_$/, ''),
  })
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })
  const short = await shortRes.json()
  if (!shortRes.ok || !short.access_token) {
    throw new HttpError(400, short.error_message ?? 'Instagram rejected the connection')
  }

  // 2) short-lived -> long-lived (60 days)
  const longUrl = new URL(`${GRAPH}/access_token`)
  longUrl.searchParams.set('grant_type', 'ig_exchange_token')
  longUrl.searchParams.set('client_secret', APP_SECRET)
  longUrl.searchParams.set('access_token', short.access_token)
  const longRes = await fetch(longUrl)
  const long = await longRes.json().catch(() => ({}))
  if (!longRes.ok || !long.access_token) {
    // Say why: Instagram's own message names the problem (secret, permissions, token). It never contains a secret.
    const why = long?.error?.message ?? long?.error_message ?? (typeof long?.error === 'string' ? long.error : '') ?? ''
    const code = long?.error?.code ?? long?.code ?? longRes.status
    console.error('instagram long-lived token exchange failed', longRes.status, JSON.stringify({ code, why, keys: Object.keys(long ?? {}), shortKeys: Object.keys(short) }))
    throw new HttpError(400, `Could not create a long-lived Instagram token (${String(why || `HTTP ${longRes.status}`).slice(0, 160)}, code ${code})`)
  }

  const expiresAt = new Date(Date.now() + (long.expires_in ?? 5_184_000) * 1000).toISOString()
  await admin.from('instagram_tokens').upsert({
    owner_id: userId, access_token: long.access_token, expires_at: expiresAt, updated_at: new Date().toISOString(),
  })

  const account = await fetchAndStoreProfile(admin, userId, long.access_token, String(short.user_id ?? ''))
  await subscribe(long.access_token)
  return account
}

/** Ask Instagram to send this account's comments and DMs to our webhook (DM automation).
 *  Safe to repeat; failures are logged, never block connecting. */
async function subscribe(token: string, on = true) {
  try {
    const url = new URL(`${GRAPH}/v21.0/me/subscribed_apps`)
    if (on) url.searchParams.set('subscribed_fields', 'comments,messages')
    url.searchParams.set('access_token', token)
    const res = await fetch(url, { method: on ? 'POST' : 'DELETE' })
    if (!res.ok) console.warn('subscribed_apps', on ? 'subscribe' : 'unsubscribe', res.status, (await res.text()).slice(0, 300))
    return res.ok
  } catch (e) {
    console.warn('subscribed_apps failed', e)
    return false
  }
}

async function sync(admin: SupabaseClient, userId: string) {
  const { data: tok } = await admin.from('instagram_tokens').select('*').eq('owner_id', userId).maybeSingle()
  if (!tok) throw new HttpError(404, 'Instagram is not connected')
  const { data: acc } = await admin.from('instagram_accounts').select('ig_user_id').eq('owner_id', userId).maybeSingle()

  let token = tok.access_token as string
  // Refresh when the long-lived token is within 10 days of expiry
  if (tok.expires_at && new Date(tok.expires_at).getTime() - Date.now() < 10 * 86_400_000) {
    const refreshUrl = new URL(`${GRAPH}/refresh_access_token`)
    refreshUrl.searchParams.set('grant_type', 'ig_refresh_token')
    refreshUrl.searchParams.set('access_token', token)
    const res = await fetch(refreshUrl)
    const refreshed = await res.json()
    if (res.ok && refreshed.access_token) {
      token = refreshed.access_token
      await admin.from('instagram_tokens').update({
        access_token: token,
        expires_at: new Date(Date.now() + (refreshed.expires_in ?? 5_184_000) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('owner_id', userId)
    } else if (new Date(tok.expires_at).getTime() < Date.now()) {
      throw new HttpError(401, 'Your Instagram connection expired. Please reconnect.')
    }
  }
  const account = await fetchAndStoreProfile(admin, userId, token, acc?.ig_user_id ?? '')
  await subscribe(token) // keeps older connections receiving comments and DMs
  return account
}

/** GET on the Instagram Graph API; throws with Meta's message on errors */
async function igGet(token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}/v21.0${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `Instagram API ${res.status}`)
  return body
}

async function fetchAndStoreProfile(admin: SupabaseClient, userId: string, token: string, igUserId: string) {
  // user_id is the professional account id that webhooks use (entry.id); id is app-scoped
  const me = await igGet(token, '/me', { fields: 'user_id,username' })
  const accountId = String(me.user_id ?? me.id ?? igUserId)

  const profile = await igGet(token, `/${accountId}`, {
    fields: 'id,username,name,biography,profile_picture_url,account_type,followers_count,follows_count,media_count',
  })

  // Recent media → average likes/comments and engagement rate
  let recent: Record<string, unknown>[] = []
  try {
    const media = await igGet(token, `/${accountId}/media`, {
      limit: '12',
      fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    })
    recent = (media.data ?? []) as Record<string, unknown>[]
  } catch (e) {
    console.warn('media fetch failed', e)
  }
  const n = recent.length
  const avgLikes = n ? recent.reduce((s, m) => s + Number(m.like_count ?? 0), 0) / n : null
  const avgComments = n ? recent.reduce((s, m) => s + Number(m.comments_count ?? 0), 0) / n : null
  const followers = Number(profile.followers_count ?? 0)
  const engagement = n && followers ? ((avgLikes! + avgComments!) / followers) * 100 : null

  // Account insights are only available for eligible professional accounts — best effort
  const insights: Record<string, number> = {}
  try {
    const res = await igGet(token, `/${accountId}/insights`, { metric: 'reach', period: 'days_28' })
    for (const m of (res.data ?? []) as { name: string; values?: { value: number }[]; total_value?: { value: number } }[]) {
      const v = m.total_value?.value ?? m.values?.at(-1)?.value
      if (typeof v === 'number') insights[m.name] = v
    }
  } catch {
    // not eligible / permission not granted
  }

  const row = {
    owner_id: userId,
    ig_user_id: accountId,
    username: profile.username,
    name: profile.name ?? null,
    biography: profile.biography ?? null,
    profile_picture_url: profile.profile_picture_url ?? null,
    account_type: (profile as Record<string, unknown>).account_type ?? null,
    followers_count: profile.followers_count ?? null,
    follows_count: profile.follows_count ?? null,
    media_count: profile.media_count ?? null,
    avg_likes: avgLikes === null ? null : Math.round(avgLikes),
    avg_comments: avgComments === null ? null : Math.round(avgComments),
    engagement_rate: engagement === null ? null : Math.round(engagement * 100) / 100,
    insights,
    recent_media: recent.slice(0, 9).map((m) => ({
      id: m.id,
      media_type: m.media_type,
      media_product_type: m.media_product_type ?? null,
      image: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url,
      permalink: m.permalink,
      like_count: m.like_count ?? null,
      comments_count: m.comments_count ?? null,
      timestamp: m.timestamp,
    })),
    last_synced_at: new Date().toISOString(),
  }

  const { data, error } = await admin.from('instagram_accounts').upsert(row).select().single()
  if (error) throw new HttpError(500, error.message)
  return data
}

// ---------- Post scheduling: publish the creator's own posts through the Instagram API ----------
async function igPost(token: string, path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}/v21.0${path}`)
  const form = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) throw new Error(body.error?.error_user_msg ?? body.error?.message ?? `Instagram API ${res.status}`)
  return body
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Publish up to a few posts that are due. Safe to run every minute; a post is only ever published once. */
async function publishDue(admin: SupabaseClient, onlyId?: string) {
  // A post is picked up when it is waiting, or when a run that took it more than 4 minutes ago must have died
  const stale = new Date(Date.now() - 4 * 60_000).toISOString()
  const due = `status.eq.scheduled,and(status.eq.publishing,or(claimed_at.is.null,claimed_at.lt.${stale}))`
  let q = admin.from('ig_scheduled_posts').select('*').or(due).lte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(5)
  if (onlyId) q = admin.from('ig_scheduled_posts').select('*').eq('id', onlyId).or(due)
  const { data: posts } = await q
  let published = 0
  let failed = 0
  for (const post of posts ?? []) {
    // Claim it so two runs never publish the same post
    const { data: claimed } = await admin.from('ig_scheduled_posts')
      .update({ status: 'publishing', attempts: post.attempts + 1, claimed_at: new Date().toISOString() }).eq('id', post.id).eq('attempts', post.attempts).or(due).select('id').maybeSingle()
    if (!claimed) continue
    try {
      const { data: tok } = await admin.from('instagram_tokens').select('access_token').eq('owner_id', post.owner_id).maybeSingle()
      const { data: acc } = await admin.from('instagram_accounts').select('ig_user_id').eq('owner_id', post.owner_id).maybeSingle()
      if (!tok?.access_token || !acc?.ig_user_id) throw new Error('Instagram is not connected. Connect it again and retry.')
      const token = tok.access_token as string

      let creationId = post.creation_id as string | null
      if (!creationId) {
        const params: Record<string, string> = { caption: post.caption ?? '' }
        if (post.media_type === 'CAROUSEL') {
          // One hidden container per photo, then one carousel container that joins them
          const photos = (post.items ?? []) as { url: string }[]
          if (photos.length < 2) throw new Error('A multi-photo post needs at least 2 photos')
          const children: string[] = []
          for (const ph of photos) children.push(String((await igPost(token, `/${acc.ig_user_id}/media`, { image_url: ph.url, is_carousel_item: 'true' })).id))
          params.media_type = 'CAROUSEL'
          params.children = children.join(',')
        } else if (post.media_type === 'REELS') {
          params.media_type = 'REELS'
          params.video_url = post.media_url
        } else params.image_url = post.media_url
        creationId = String((await igPost(token, `/${acc.ig_user_id}/media`, params)).id)
        await admin.from('ig_scheduled_posts').update({ creation_id: creationId }).eq('id', post.id)
      }
      // Videos are processed by Instagram first
      let ready = post.media_type === 'IMAGE'
      for (let i = 0; i < 12 && !ready; i++) {
        const st = await igGet(token, `/${creationId}`, { fields: 'status_code,status' })
        if (st.status_code === 'FINISHED') ready = true
        else if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`Instagram could not process the video (${st.status ?? st.status_code})`)
        else await sleep(8000)
      }
      if (!ready) {
        await admin.from('ig_scheduled_posts').update({ status: 'scheduled' }).eq('id', post.id) // still processing: continue next minute
        continue
      }
      const done = await igPost(token, `/${acc.ig_user_id}/media_publish`, { creation_id: creationId })
      const mediaId = String(done.id)
      let permalink: string | null = null
      try {
        permalink = String((await igGet(token, `/${mediaId}`, { fields: 'permalink' })).permalink ?? '') || null
      } catch {
        /* the post is live either way */
      }
      const paths = [post.media_path, ...(((post.items ?? []) as { path: string }[]).map((i) => i.path))].filter(Boolean)
      await admin.from('ig_scheduled_posts').update({ status: 'published', ig_media_id: mediaId, permalink, published_at: new Date().toISOString(), error: null, media_url: '', media_path: '', items: [] }).eq('id', post.id)
      // The files are on Instagram now. Keep any that a LinkedIn or YouTube copy of this post still needs; the hourly cleanup catches the rest.
      const unused: string[] = []
      for (const path of new Set(paths)) {
        const { data: inUse } = await admin.rpc('social_media_in_use', { p_path: path })
        if (!inUse) unused.push(path)
      }
      if (unused.length) await admin.storage.from('ig-posts').remove(unused).catch(() => {})
      published++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('publish failed', post.id, message)
      const permission = /permission|scope|content_publish|OAuth/i.test(message)
      await admin.from('ig_scheduled_posts').update({
        status: 'failed',
        error: (permission ? 'Instagram needs your permission to post for you. Reconnect Instagram in Settings and try again. ' : '') + message.slice(0, 300),
      }).eq('id', post.id)
      failed++
    }
  }
  return { ok: true, published, failed }
}
