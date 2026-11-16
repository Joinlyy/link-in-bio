// Meta callbacks for Instagram business login (App settings → Business login settings):
//   Deauthorize callback URL:   …/functions/v1/instagram-data?event=deauthorize
//   Data deletion request URL:  …/functions/v1/instagram-data?event=delete
// Meta POSTs a form field `signed_request` = base64url(HMAC-SHA256 signature) "." base64url(JSON payload),
// signed with the Instagram app secret. The payload's user_id is the Instagram user who removed the app.
//
// deauthorize: the creator removed JOINLYY from Instagram → drop the connection (token + profile data).
// delete:      the creator asked Meta to delete their data → also delete their DM automation history, and
//              answer with a status URL and confirmation code, as Meta requires.
// Secrets: INSTAGRAM_APP_SECRET, APP_ORIGIN
import { adminClient } from '../_shared/utils.ts'

const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? ''
const APP = (Deno.env.get('APP_ORIGIN') ?? 'https://joinlyy.com').replace(/\/$/, '')

function b64urlDecode(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** The verified payload, or null if the signature doesn't match */
async function parseSignedRequest(signed: string): Promise<Record<string, unknown> | null> {
  const [sig, payload] = signed.split('.', 2)
  if (!sig || !payload) return null
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), new TextEncoder().encode(payload))
  if (!ok) return null
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)))
    if (data.algorithm && String(data.algorithm).toUpperCase() !== 'HMAC-SHA256') return null
    return data
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!APP_SECRET) return new Response('Not configured', { status: 503 })

  const event = new URL(req.url).searchParams.get('event')
  if (event !== 'deauthorize' && event !== 'delete') return new Response('Unknown event', { status: 400 })

  let signed = ''
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) signed = String((await req.json().catch(() => ({}))).signed_request ?? '')
  else signed = String((await req.formData().catch(() => new FormData())).get('signed_request') ?? '')

  const data = signed ? await parseSignedRequest(signed) : null
  if (!data?.user_id) return new Response('Invalid signed_request', { status: 400 })
  const igUserId = String(data.user_id)

  const db = adminClient()
  const code = crypto.randomUUID().replaceAll('-', '').slice(0, 16)
  await db.from('instagram_data_requests').insert({ code, kind: event, ig_user_id: igUserId })

  const { data: acc } = await db.from('instagram_accounts').select('owner_id').eq('ig_user_id', igUserId).maybeSingle()
  if (acc) {
    await db.from('instagram_tokens').delete().eq('owner_id', acc.owner_id)
    await db.from('instagram_accounts').delete().eq('owner_id', acc.owner_id)
    if (event === 'delete') {
      // Automation history holds data that came from Instagram (usernames, messages)
      await db.from('dm_events').delete().eq('owner_id', acc.owner_id)
    }
  }
  await db.from('instagram_data_requests').update({ found: Boolean(acc), completed_at: new Date().toISOString() }).eq('code', code)

  if (event === 'delete') {
    return Response.json({ url: `${APP}/data-deletion?code=${code}`, confirmation_code: code })
  }
  return Response.json({ ok: true })
})
