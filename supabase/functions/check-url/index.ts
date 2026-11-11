// Google Safe Browsing check for links creators add.
// Without GOOGLE_SAFE_BROWSING_KEY it reports { checked: false } and the DB blocklist still applies.
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'

const KEY = Deno.env.get('GOOGLE_SAFE_BROWSING_KEY') ?? ''

Deno.serve(handle(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const { url, block_id } = await req.json().catch(() => ({}))
  if (!url || typeof url !== 'string') throw new HttpError(400, 'Missing url')
  if (!KEY) return json({ safe: true, checked: false })

  const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client: { clientId: 'linkinbio', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    }),
  })
  if (!res.ok) return json({ safe: true, checked: false })
  const body = await res.json()
  const unsafe = Array.isArray(body.matches) && body.matches.length > 0
  if (!unsafe) return json({ safe: true, checked: true })

  // Disable the block and flag the page for admin review
  if (block_id) {
    const { data: block } = await admin.from('blocks').select('id, page_id, pages!inner(owner_id)').eq('id', block_id).maybeSingle()
    const isOwner = block && (block as { pages: { owner_id: string } }).pages.owner_id === user.id
    const { data: member } = block && !isOwner
      ? await admin.from('page_members').select('role').eq('page_id', block.page_id).eq('user_id', user.id)
          .not('accepted_at', 'is', null).in('role', ['admin', 'editor']).maybeSingle()
      : { data: null }
    if (block && (isOwner || member)) {
      await admin.from('blocks').update({ is_active: false }).eq('id', block_id)
      await admin.from('reports').insert({
        page_id: block.page_id,
        reason: 'phishing',
        details: `Automatic: Google Safe Browsing flagged ${url} (${body.matches.map((m: { threatType: string }) => m.threatType).join(', ')})`,
      })
    }
  }
  return json({ safe: false, checked: true, threats: body.matches.map((m: { threatType: string }) => m.threatType) })
}))
