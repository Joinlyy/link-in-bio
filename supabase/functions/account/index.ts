// Account self-service: permanent deletion (data-protection request).
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'

Deno.serve(handle(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const { action } = await req.json().catch(() => ({}))

  if (action === 'delete') {
    // Raw analytics events carry no FK (kept lean for ingestion), so clear them explicitly
    const { data: pages } = await admin.from('pages').select('id').eq('owner_id', user.id)
    const ids = (pages ?? []).map((p) => p.id)
    if (ids.length) await admin.from('events').delete().in('page_id', ids)
    // Cascades through profiles → pages → blocks, leads, rollups, Instagram data
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new HttpError(500, error.message)
    return json({ ok: true })
  }

  throw new HttpError(400, 'Unknown action')
}))
