// Instagram webhook → DM automation (comment-to-DM, story replies, DM keywords),
// plus follow-to-unlock, lead collection and timed follow-ups.
// Built on github.com/urlsandcodes/instagram-platform (signature check, private replies, DMs).
//
// Meta App → Instagram → Webhooks:
//   Callback URL: https://<project>.supabase.co/functions/v1/instagram-webhook
//   Verify token: value of INSTAGRAM_WEBHOOK_VERIFY_TOKEN
//   Subscribe to: comments, messages
// Cron (pg_cron → pg_net): POST with header `x-cron-secret: <CRON_SECRET>` sends due follow-ups.
// Secrets: INSTAGRAM_APP_SECRET, INSTAGRAM_WEBHOOK_VERIFY_TOKEN, CRON_SECRET
import { InstagramClient, verifyWebhookSignature } from 'npm:instagram-platform@1.0.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient } from '../_shared/utils.ts'

const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? ''
const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const GRAPH = 'https://graph.instagram.com'
const DAY = 24 * 3600_000
const MAX_FOLLOW_REMINDERS = 3

const DEFAULT_FOLLOW_PROMPT = 'Follow me and reply DONE to get the link 🙌'
const DEFAULT_COLLECT_PROMPT = {
  email: 'Reply with your email and I’ll send it there too 📩',
  phone: 'Reply with your WhatsApp number and I’ll send it there too 📲',
}
const DEFAULT_COLLECT_THANKS = 'Got it, thank you! 🙏'
const CONSENT_TEXT = 'Shared voluntarily via Instagram DM in reply to an automation'

type Rule = {
  id: string
  owner_id: string
  page_id: string | null
  trigger: 'comment' | 'story_reply' | 'dm_keyword'
  keywords: string[]
  media_id: string | null
  comment_reply: string | null
  message: string
  button_title: string | null
  button_url: string | null
  require_follow: boolean
  follow_prompt: string | null
  collect: 'email' | 'phone' | null
  collect_prompt: string | null
  collect_thanks: string | null
  follow_up_message: string | null
  follow_up_minutes: number | null
}

type DmEvent = {
  id: number
  rule_id: string | null
  ig_user_id: string | null
  ig_username: string | null
  awaiting: 'follow' | 'collect' | null
  window_until: string | null
  created_at: string
}

type Account = NonNullable<Awaited<ReturnType<typeof loadAccount>>>
type Msg = { text?: string; attachment?: unknown }

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Subscription handshake
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && VERIFY_TOKEN && safeEqual(url.searchParams.get('hub.verify_token') ?? '', VERIFY_TOKEN)) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Scheduled follow-ups (pg_cron). Requires the shared secret instead of Meta's signature.
  const cronHeader = req.headers.get('x-cron-secret')
  if (cronHeader !== null) {
    if (!CRON_SECRET || !safeEqual(cronHeader, CRON_SECRET)) return new Response('Unauthorized', { status: 401 })
    try {
      const result = await sendDueFollowUps(adminClient())
      return Response.json(result)
    } catch (e) {
      console.error('follow-up cron error', e)
      return Response.json({ error: 'Follow-ups failed' }, { status: 500 })
    }
  }

  // Without the app secret, anyone could sign a fake event: refuse instead
  if (!APP_SECRET) return new Response('Not configured', { status: 503 })
  const raw = await req.text()
  if (!verifyWebhookSignature(raw, req.headers.get('x-hub-signature-256') ?? undefined, APP_SECRET)) {
    return new Response('Invalid signature', { status: 401 })
  }

  // Acknowledge fast; Meta retries slow endpoints. Process in the background.
  const work = processPayload(JSON.parse(raw)).catch((e) => console.error('webhook error', e))
  // @ts-ignore EdgeRuntime is available on Supabase
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
  else await work
  return new Response('EVENT_RECEIVED', { status: 200 })
})

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

async function processPayload(payload: { object: string; entry: Array<Record<string, any>> }) {
  if (payload.object !== 'instagram') return
  const admin = adminClient()
  for (const entry of payload.entry ?? []) {
    const igId = String(entry.id)
    const account = await loadAccount(admin, igId)
    if (!account) continue

    for (const change of entry.changes ?? []) {
      if (change.field === 'comments') await onComment(admin, account, change.value)
    }
    for (const m of entry.messaging ?? []) {
      if (m.message && !m.message.is_echo && String(m.sender?.id) !== igId) await onMessage(admin, account, m)
    }
  }
}

async function loadAccount(admin: SupabaseClient, igId: string) {
  const { data: acc } = await admin.from('instagram_accounts').select('owner_id, ig_user_id, username').eq('ig_user_id', igId).maybeSingle()
  if (!acc) return null
  const { data: tok } = await admin.from('instagram_tokens').select('access_token').eq('owner_id', acc.owner_id).maybeSingle()
  if (!tok) return null
  const { data: rules } = await admin.from('dm_rules').select('*').eq('owner_id', acc.owner_id).eq('is_active', true)
  const client = makeClient(tok.access_token, igId)
  return { ...acc, client, rules: (rules ?? []) as Rule[] }
}

function makeClient(accessToken: string, igId: string) {
  return new InstagramClient({ accessToken, instagramAccountId: igId, baseUrl: GRAPH, maxRetries: 2, timeout: 10000 })
}

function matches(rule: Rule, text: string) {
  if (!rule.keywords.length) return true // "any comment / any reply"
  const t = ` ${text.toLowerCase()} `
  return rule.keywords.some((k) => k && t.includes(k.toLowerCase().trim()))
}

function buildMessage(rule: Rule, plainText = false): Msg {
  if (rule.button_url && rule.button_title && !plainText) {
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{ title: rule.message.slice(0, 80), subtitle: rule.message.length > 80 ? rule.message.slice(80, 160) : undefined,
            buttons: [{ type: 'web_url', url: rule.button_url, title: rule.button_title }] }],
        },
      },
    }
  }
  return { text: rule.button_url ? `${rule.message}\n\n${rule.button_url}` : rule.message }
}

const followPrompt = (rule: Rule) => rule.follow_prompt?.trim() || DEFAULT_FOLLOW_PROMPT
const collectPrompt = (rule: Rule) => rule.collect_prompt?.trim() || DEFAULT_COLLECT_PROMPT[rule.collect ?? 'email']
const collectThanks = (rule: Rule) => rule.collect_thanks?.trim() || DEFAULT_COLLECT_THANKS
const errText = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300)

async function claim(admin: SupabaseClient, ownerId: string, sourceId: string) {
  // Unique (owner_id, source_id) makes webhook retries idempotent
  const { data, error } = await admin.from('dm_events')
    .insert({ owner_id: ownerId, source_id: sourceId, event: 'pending', status: 'skipped' })
    .select('id').single()
  return error ? null : data.id as number
}

async function finish(admin: SupabaseClient, id: number, patch: Record<string, unknown>, ruleId?: string) {
  await admin.from('dm_events').update(patch).eq('id', id)
  if (ruleId && patch.status === 'sent') {
    const { data } = await admin.from('dm_rules').select('sent_count').eq('id', ruleId).single()
    await admin.from('dm_rules').update({ sent_count: (data?.sent_count ?? 0) + 1 }).eq('id', ruleId)
  }
}

/** Latest event for this person in the last 24h — the single source of truth for "awaiting" state. */
async function latestEvent(admin: SupabaseClient, ownerId: string, igUserId: string): Promise<DmEvent | null> {
  const { data } = await admin.from('dm_events')
    .select('id, rule_id, ig_user_id, ig_username, awaiting, window_until, created_at')
    .eq('owner_id', ownerId).eq('ig_user_id', igUserId).neq('event', 'pending')
    .gte('created_at', new Date(Date.now() - DAY).toISOString())
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle()
  return (data as DmEvent | null) ?? null
}

/** An open messaging window for this person (they messaged us within 24h), if any. */
async function openWindow(admin: SupabaseClient, ownerId: string, igUserId: string) {
  const { data } = await admin.from('dm_events')
    .select('window_until')
    .eq('owner_id', ownerId).eq('ig_user_id', igUserId).gt('window_until', new Date().toISOString())
    .order('window_until', { ascending: false }).limit(1).maybeSingle()
  return (data?.window_until as string | undefined) ?? null
}

/** Follow-up scheduling fields for an event whose main message was just delivered. */
function followUpFields(rule: Rule, windowUntil: string | null) {
  if (!windowUntil || !rule.follow_up_message?.trim()) return {}
  const minutes = Math.min(Math.max(rule.follow_up_minutes ?? 60, 5), 1380)
  const at = new Date(Date.now() + minutes * 60_000)
  if (at.getTime() >= new Date(windowUntil).getTime()) return {} // would land outside the 24h window
  return { follow_up_at: at.toISOString(), follow_up_sent: false }
}

/** Send the rule's main message, optionally followed by the lead-collection prompt. */
async function sendMain(account: Account, rule: Rule, to: { igsid: string } | { commentId: string }) {
  if ('commentId' in to) {
    // A private reply is a single message; fold the collect prompt into it.
    const msg = rule.collect ? { text: `${buildMessage(rule, true).text}\n\n${collectPrompt(rule)}` } : buildMessage(rule)
    await account.client.http.post(`/${account.ig_user_id}/messages`, { recipient: { comment_id: to.commentId }, message: msg })
    return
  }
  await account.client.messaging.sendMessage(to.igsid, buildMessage(rule))
  if (rule.collect) await account.client.messaging.sendMessage(to.igsid, { text: collectPrompt(rule) })
}

async function onComment(admin: SupabaseClient, account: Account, value: Record<string, any>) {
  const commentId = String(value.id ?? '')
  const text = String(value.text ?? '')
  const mediaId = String(value.media?.id ?? '')
  const fromId = value.from?.id ? String(value.from.id) : null
  if (!commentId || fromId === account.ig_user_id) return // ignore own comments

  const rule = account.rules.find((r) => r.trigger === 'comment' && (!r.media_id || r.media_id === mediaId) && matches(r, text))
  if (!rule) return
  const eventId = await claim(admin, account.owner_id, `c_${commentId}`)
  if (!eventId) return
  const base = { event: 'comment', rule_id: rule.id, ig_user_id: fromId, ig_username: value.from?.username ?? null }
  // A new trigger supersedes anything we were still waiting for from this person
  if (fromId) {
    await admin.from('dm_events').update({ awaiting: null })
      .eq('owner_id', account.owner_id).eq('ig_user_id', fromId).not('awaiting', 'is', null)
  }

  try {
    if (rule.require_follow) {
      // Private reply (DM) asking them to follow first; their reply opens the messaging window
      await account.client.http.post(`/${account.ig_user_id}/messages`, { recipient: { comment_id: commentId }, message: { text: followPrompt(rule) } })
      if (rule.comment_reply) await account.client.comments.reply(commentId, rule.comment_reply).catch(() => {})
      await finish(admin, eventId, { ...base, status: 'sent', awaiting: 'follow' })
      return
    }
    // Private reply (DM) to the commenter — allowed once per comment within 7 days
    await sendMain(account, rule, { commentId })
    if (rule.comment_reply) await account.client.comments.reply(commentId, rule.comment_reply).catch(() => {})
    const windowUntil = fromId ? await openWindow(admin, account.owner_id, fromId) : null
    await finish(admin, eventId, {
      ...base, status: 'sent', awaiting: rule.collect ? 'collect' : null,
      window_until: windowUntil, ...followUpFields(rule, windowUntil),
    }, rule.id)
  } catch (e) {
    await finish(admin, eventId, { ...base, status: 'failed', error: errText(e) })
  }
}

async function onMessage(admin: SupabaseClient, account: Account, m: Record<string, any>) {
  const text = String(m.message?.text ?? '')
  const isStoryReply = Boolean(m.message?.reply_to?.story)
  const senderId = String(m.sender.id)
  const sentAt = Number(m.timestamp) || Date.now()
  // The person just messaged us: we may reply for 24h from their message
  const windowUntil = new Date(sentAt + DAY).toISOString()

  // 1) Continue a pending conversation (follow-to-unlock / lead collection)
  const last = await latestEvent(admin, account.owner_id, senderId)
  if (last?.awaiting) {
    const rule = account.rules.find((r) => r.id === last.rule_id)
    if (!rule) {
      // Automation was deleted or paused — stop waiting
      await admin.from('dm_events').update({ awaiting: null }).eq('id', last.id)
    } else if (last.awaiting === 'follow') {
      return await continueFollow(admin, account, rule, last, m, senderId, windowUntil)
    } else if (last.awaiting === 'collect') {
      const handled = await continueCollect(admin, account, rule, last, m, senderId, text, windowUntil)
      if (handled) return
      // Not an email/phone — treat it as a normal message below
    }
  }

  // 2) New trigger
  const rule = account.rules.find((r) =>
    isStoryReply ? r.trigger === 'story_reply' && matches(r, text) : r.trigger === 'dm_keyword' && r.keywords.length > 0 && matches(r, text),
  )
  if (!rule) return
  const eventId = await claim(admin, account.owner_id, `m_${m.message.mid}`)
  if (!eventId) return
  const base = { event: isStoryReply ? 'story_reply' : 'dm', rule_id: rule.id, ig_user_id: senderId, ig_username: last?.ig_username ?? null, window_until: windowUntil }
  if (last?.awaiting) await admin.from('dm_events').update({ awaiting: null }).eq('id', last.id)

  try {
    // Replies inside the 24h window opened by the user's message
    if (rule.require_follow) {
      await account.client.messaging.sendMessage(senderId, { text: followPrompt(rule) })
      await finish(admin, eventId, { ...base, status: 'sent', awaiting: 'follow' })
      return
    }
    await sendMain(account, rule, { igsid: senderId })
    await finish(admin, eventId, { ...base, status: 'sent', awaiting: rule.collect ? 'collect' : null, ...followUpFields(rule, windowUntil) }, rule.id)
  } catch (e) {
    await finish(admin, eventId, { ...base, status: 'failed', error: errText(e) })
  }
}

async function continueFollow(
  admin: SupabaseClient, account: Account, rule: Rule, last: DmEvent, m: Record<string, any>, senderId: string, windowUntil: string,
) {
  const eventId = await claim(admin, account.owner_id, `m_${m.message.mid}`)
  if (!eventId) return
  await admin.from('dm_events').update({ awaiting: null }).eq('id', last.id)

  let following: boolean | null = null
  let username: string | null = last.ig_username
  let checkError: string | null = null
  try {
    const profile = await account.client.messaging.getUserProfile(senderId, ['username', 'is_user_follow_business']) as Record<string, unknown>
    following = Boolean(profile.is_user_follow_business)
    if (typeof profile.username === 'string') username = profile.username
  } catch (e) {
    // Can't verify (permission/consent) — fail open so the person still gets what they asked for
    checkError = `Couldn’t verify follow: ${errText(e)}`
  }
  const base = { rule_id: rule.id, ig_user_id: senderId, ig_username: username, window_until: windowUntil }

  try {
    if (following === false) {
      const { count } = await admin.from('dm_events').select('id', { count: 'exact', head: true })
        .eq('owner_id', account.owner_id).eq('ig_user_id', senderId).eq('rule_id', rule.id).eq('event', 'follow_prompt').eq('status', 'sent')
        .gte('created_at', new Date(Date.now() - DAY).toISOString())
      if ((count ?? 0) >= MAX_FOLLOW_REMINDERS) {
        await finish(admin, eventId, { ...base, event: 'follow_prompt', status: 'skipped', error: `Not following after ${MAX_FOLLOW_REMINDERS} reminders` })
        return
      }
      await account.client.messaging.sendMessage(senderId, { text: followPrompt(rule) })
      await finish(admin, eventId, { ...base, event: 'follow_prompt', status: 'sent', awaiting: 'follow' })
      return
    }
    await sendMain(account, rule, { igsid: senderId })
    await finish(admin, eventId, {
      ...base, event: 'unlocked', status: 'sent', error: checkError,
      awaiting: rule.collect ? 'collect' : null, ...followUpFields(rule, windowUntil),
    }, rule.id)
  } catch (e) {
    await finish(admin, eventId, { ...base, event: 'unlocked', status: 'failed', error: errText(e) })
  }
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i
const PHONE_RE = /(?<!\d)(?:\+?91|0)?([6-9]\d{9})(?!\d)/

function parseContact(text: string) {
  const email = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null
  const digits = text.replace(/[\s\-().]/g, '')
  const m = digits.match(PHONE_RE)
  const phone = m ? `+91${m[1]}` : null
  return { email: email && email.length <= 200 ? email : null, phone }
}

async function continueCollect(
  admin: SupabaseClient, account: Account, rule: Rule, last: DmEvent, m: Record<string, any>, senderId: string, text: string, windowUntil: string,
) {
  const { email, phone } = parseContact(text)
  if (!email && !phone) return false

  const eventId = await claim(admin, account.owner_id, `m_${m.message.mid}`)
  if (!eventId) return true
  await admin.from('dm_events').update({ awaiting: null }).eq('id', last.id)

  let username = last.ig_username
  if (!username) {
    try {
      const profile = await account.client.messaging.getUserProfile(senderId, ['username']) as Record<string, unknown>
      if (typeof profile.username === 'string') username = profile.username
    } catch {
      // name is optional
    }
  }
  const base = { event: 'lead', rule_id: rule.id, ig_user_id: senderId, ig_username: username, window_until: windowUntil }

  try {
    let pageId = rule.page_id
    if (!pageId) {
      const { data: pg } = await admin.from('pages').select('id').eq('owner_id', account.owner_id).order('created_at').limit(1).maybeSingle()
      pageId = pg?.id ?? null
    }
    if (!pageId) throw new Error('No page to save the lead to')
    const { error } = await admin.from('leads').insert({
      page_id: pageId,
      name: username ? `@${username}`.slice(0, 120) : null,
      email, phone,
      consent: true,
      consent_text: CONSENT_TEXT,
    })
    if (error) throw new Error(error.message)
    await account.client.messaging.sendMessage(senderId, { text: collectThanks(rule) }).catch((e) => console.warn('thanks failed', e))
    await finish(admin, eventId, { ...base, status: 'sent' })
  } catch (e) {
    await finish(admin, eventId, { ...base, status: 'failed', error: errText(e) })
  }
  return true
}

// ---------------------------------------------------------------------
// Cron: timed follow-ups inside the 24h messaging window
// ---------------------------------------------------------------------
async function sendDueFollowUps(admin: SupabaseClient) {
  const now = new Date().toISOString()

  // Windows that closed before the follow-up was due can never be sent — drop them
  await admin.from('dm_events').update({ follow_up_at: null })
    .lte('follow_up_at', now).eq('follow_up_sent', false).lte('window_until', now)

  const { data: due, error } = await admin.from('dm_events')
    .select('id, owner_id, rule_id, ig_user_id')
    .lte('follow_up_at', now).eq('follow_up_sent', false).gt('window_until', now)
    .order('follow_up_at').limit(200)
  if (error) throw new Error(error.message)

  const clients = new Map<string, ReturnType<typeof makeClient> | null>()
  const rules = new Map<string, Rule | null>()
  let sent = 0, failed = 0, skipped = 0

  for (const ev of due ?? []) {
    // Claim first so overlapping cron runs never double-send
    const { data: claimed } = await admin.from('dm_events').update({ follow_up_sent: true })
      .eq('id', ev.id).eq('follow_up_sent', false).select('id').maybeSingle()
    if (!claimed) continue

    if (!rules.has(ev.rule_id)) {
      const { data } = await admin.from('dm_rules').select('*').eq('id', ev.rule_id).eq('is_active', true).maybeSingle()
      rules.set(ev.rule_id, (data as Rule | null) ?? null)
    }
    const rule = rules.get(ev.rule_id)
    if (!rule?.follow_up_message?.trim() || !ev.ig_user_id) { skipped++; continue }

    if (!clients.has(ev.owner_id)) {
      const { data: acc } = await admin.from('instagram_accounts').select('ig_user_id').eq('owner_id', ev.owner_id).maybeSingle()
      const { data: tok } = await admin.from('instagram_tokens').select('access_token').eq('owner_id', ev.owner_id).maybeSingle()
      clients.set(ev.owner_id, acc && tok ? makeClient(tok.access_token, acc.ig_user_id) : null)
    }
    const client = clients.get(ev.owner_id)
    if (!client) { skipped++; continue }

    try {
      await client.messaging.sendMessage(ev.ig_user_id, { text: rule.follow_up_message })
      sent++
    } catch (e) {
      failed++
      await admin.from('dm_events').update({ error: `Follow-up failed: ${errText(e)}`.slice(0, 300) }).eq('id', ev.id)
    }
  }
  return { ok: true, due: due?.length ?? 0, sent, failed, skipped }
}
