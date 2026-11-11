// Vercel Edge Function: first-party analytics relay.
// Adds coarse geo (state / city) from Vercel's edge headers, then forwards the
// event to the Supabase track_event RPC. The visitor's IP is never stored or forwarded.
export const config = { runtime: 'edge' }

const FIELDS = ['p_page_id', 'p_type', 'p_block_id', 'p_visitor', 'p_source', 'p_device', 'p_browser', 'p_os', 'p_medium', 'p_campaign']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function header(req, name) {
  const v = req.headers.get(name)
  if (!v) return null
  try {
    return decodeURIComponent(v).slice(0, 64)
  } catch {
    return v.slice(0, 64)
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })

  let body
  try {
    const text = await req.text()
    if (text.length > 4096) return new Response(null, { status: 413 })
    body = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400 })
  }
  if (!body || typeof body !== 'object' || !UUID_RE.test(String(body.p_page_id || ''))) return new Response(null, { status: 400 })

  const payload = {}
  for (const k of FIELDS) {
    const v = body[k]
    if (v == null || v === '') continue
    if (typeof v !== 'string') continue
    payload[k] = v.slice(0, 128)
  }
  if (payload.p_block_id && !UUID_RE.test(payload.p_block_id)) delete payload.p_block_id

  // Region codes are ISO 3166-2 subdivisions without the country ("MH"); prefix
  // foreign ones ("US-CA") so they can't be confused with Indian states.
  const country = header(req, 'x-vercel-ip-country')
  const region = header(req, 'x-vercel-ip-country-region')
  const city = header(req, 'x-vercel-ip-city')
  if (region) payload.p_region = country && country !== 'IN' ? `${country}-${region}` : region
  if (city) payload.p_city = city

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return new Response(null, { status: 500 })

  try {
    const res = await fetch(`${url}/rest/v1/rpc/track_event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return new Response(null, { status: 502 })
  } catch {
    return new Response(null, { status: 502 })
  }
  return new Response(null, { status: 204 })
}
