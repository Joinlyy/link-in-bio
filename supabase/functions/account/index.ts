// Account self-service: permanent deletion (data-protection request).
import { adminClient, handle, HttpError, json, requireUser } from '../_shared/utils.ts'

Deno.serve(handle(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const { action } = await req.json().catch(() => ({}))

  if (action === 'delete') {
    // Not while we owe the creator money or buyers are waiting for a session
    const { data: block, error: blockErr } = await admin.rpc('account_delete_blockers', { p_user: user.id })
    if (blockErr) throw new HttpError(500, blockErr.message)
    const owed = Number(block?.balance ?? 0)
    const upcoming = Number(block?.sessions ?? 0) + Number(block?.webinars ?? 0)
    if (owed > 0) throw new HttpError(409, `You can't delete your account yet: Joinlyy still owes you ₹${owed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}. Add your payout UPI ID and wait for the payout, then try again.`)
    if (upcoming > 0) throw new HttpError(409, `You can't delete your account yet: ${upcoming} paid session${upcoming === 1 ? '' : 's'} or webinar${upcoming === 1 ? '' : 's'} still to happen. Hold them, or contact support to refund the buyers first.`)
    // Raw analytics events carry no FK (kept lean for ingestion), so clear them explicitly
    const { data: pages } = await admin.from('pages').select('id').eq('owner_id', user.id)
    const ids = (pages ?? []).map((p) => p.id)
    if (ids.length) await admin.from('events').delete().in('page_id', ids)
    // Keep only the money totals, under the name Gone_<name>, so the admin numbers stay right
    const { error: snapErr } = await admin.rpc('snapshot_gone_account', { p_user: user.id })
    if (snapErr) throw new HttpError(500, snapErr.message)
    // Cascades through profiles → pages → blocks, leads, rollups, Instagram data
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new HttpError(500, error.message)
    return json({ ok: true })
  }

  throw new HttpError(400, 'Unknown action')
}))
