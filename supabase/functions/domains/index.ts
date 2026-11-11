// Custom domain verification.
// POST { action: 'verify', page_id } with the creator's session.
//   1) TXT  _linkinbio.<domain>  must contain pages.domain_token (proves ownership)
//   2) <domain> must point at us via CNAME (subdomains) or A (apex)
// Lookups use DNS-over-HTTPS (Google, Cloudflare fallback). On success the page is marked
// domain_status = 'verified'; an admin then activates it once the domain is added to hosting.
//
// Secrets (optional): CUSTOM_DOMAIN_TARGET (default cname.vercel-dns.com)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'

const TARGET = (Deno.env.get('CUSTOM_DOMAIN_TARGET') ?? 'cname.vercel-dns.com').toLowerCase().replace(/\.$/, '')
const TYPES = { A: 1, CNAME: 5, TXT: 16 } as const
type RecordType = keyof typeof TYPES

Deno.serve(handle(async (req) => {
  const admin = adminClient()
  await requireUser(req, admin)
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'verify') throw new HttpError(400, 'Unknown action')
  if (!body.page_id || typeof body.page_id !== 'string') throw new HttpError(400, 'Missing page')

  // Caller-scoped client: RLS decides which pages they can see
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: page } = await userClient.from('pages')
    .select('id, custom_domain, domain_status, domain_token').eq('id', body.page_id).maybeSingle()
  if (!page) throw new HttpError(404, 'Page not found')
  const { data: canEdit } = await userClient.rpc('can_edit_page', { p_page_id: page.id })
  if (!canEdit) throw new HttpError(403, 'You don’t have permission to change this page')
  if (!page.custom_domain || !page.domain_token) throw new HttpError(400, 'Add a custom domain first')

  const domain = String(page.custom_domain)
  const [txt, cname, a] = await Promise.all([
    resolve(`_linkinbio.${domain}`, 'TXT'),
    resolve(domain, 'CNAME'),
    resolve(domain, 'A'),
  ])

  const txtValues = txt.map((v) => v.replace(/^"|"$/g, '').replace(/"\s*"/g, ''))
  const txt_ok = txtValues.some((v) => v.trim() === page.domain_token)
  const cnames = cname.map((v) => v.toLowerCase().replace(/\.$/, ''))
  const dns_ok = cnames.length > 0 || a.length > 0
  const points_to_target = cnames.includes(TARGET)
  const found = { txt: txtValues, cname: cnames, a, recommended_cname: TARGET }

  const problems: string[] = []
  if (!txt_ok) {
    problems.push(txtValues.length
      ? `The TXT record _linkinbio.${domain} doesn’t match your verification code.`
      : `No TXT record found at _linkinbio.${domain} yet.`)
  }
  if (!dns_ok) problems.push(`${domain} has no CNAME or A record. Add a CNAME to ${TARGET}.`)

  if (problems.length) {
    return json({
      ok: false, txt_ok, dns_ok, found,
      message: `${problems.join(' ')} DNS changes can take up to an hour to show up — try again soon.`,
    })
  }

  // Don't downgrade a domain that's already live
  if (page.domain_status !== 'active') {
    const { error } = await admin.from('pages')
      .update({ domain_status: 'verified', domain_verified_at: new Date().toISOString() }).eq('id', page.id)
    if (error) throw new HttpError(500, error.message)
  }

  return json({
    ok: true, txt_ok, dns_ok, found,
    message: page.domain_status === 'active'
      ? `${domain} is verified and live.`
      : points_to_target
        ? `${domain} is verified. We’ll switch it on shortly.`
        : `${domain} is verified. It currently points to ${cnames[0] ?? a.join(', ')} — for it to load your page, point it to ${TARGET}.`,
  })
}))

/** DNS-over-HTTPS lookup; returns the record data for the requested type (empty when none). */
async function resolve(name: string, type: RecordType): Promise<string[]> {
  const endpoints = [
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const body = await res.json() as { Status: number; Answer?: { type: number; data: string }[] }
      // 0 = NOERROR, 3 = NXDOMAIN (a definitive "nothing here")
      if (body.Status !== 0 && body.Status !== 3) continue
      return (body.Answer ?? []).filter((r) => r.type === TYPES[type]).map((r) => String(r.data))
    } catch {
      // try the next resolver
    }
  }
  return []
}
