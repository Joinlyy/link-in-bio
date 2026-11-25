import { useCallback, useEffect, useState } from 'react'
import { Copy, IndianRupee } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { Alert, Badge, Button, Card, Empty, Input, Modal, Spinner, Tabs, useToast } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')

/** What every creator has earned through Joinlyy, what is owed, and a place to record each payout you send by hand */
export default function AdminPayouts() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('owed')
  const [pay, setPay] = useState(null)
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [{ data, error: err }, { data: hist }] = await Promise.all([
      supabase.rpc('admin_creator_earnings'),
      supabase.from('creator_payouts').select('id, user_id, amount_inr, upi_id, reference, note, created_at').order('created_at', { ascending: false }).limit(200),
    ])
    if (err) return setError(errorMessage(err))
    setRows(data || [])
    setHistory(hist || [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  if (error) return <Alert>{error}</Alert>
  if (!rows || !history) return <div className="grid h-60 place-items-center"><Spinner /></div>

  const who = (id) => rows.find((r) => r.user_id === id)
  const owed = rows.reduce((s, r) => s + Number(r.balance), 0)
  const ready = rows.reduce((s, r) => s + Number(r.payable_now), 0)
  const held = rows.reduce((s, r) => s + Number(r.held), 0)
  const commission = rows.reduce((s, r) => s + Number(r.commission), 0)
  const visible = rows.filter((r) => (tab === 'owed' ? Number(r.balance) > 0 : true))

  function openPay(r) {
    setPay(r)
    setAmount(String(Number(r.payable_now) > 0 ? Number(r.payable_now).toFixed(2) : Number(r.balance).toFixed(2)))
    setReference('')
    setNote('')
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied')
    } catch {
      toast(text)
    }
  }
  async function record() {
    setBusy(true)
    const { error: err } = await supabase.rpc('admin_record_payout', { p_user: pay.user_id, p_amount: Number(amount), p_reference: reference, p_note: note || null })
    setBusy(false)
    if (err) return toast(errorMessage(err), 'error')
    toast('Payout recorded. The creator gets an email.')
    setPay(null)
    load()
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Creator payouts." italic={`${inr(owed)} owed.`}>
        Buyers pay Joinlyy. Each creator’s share (sale minus our commission) is owed to them. Send it from your account to their UPI ID, then record it here so the balance goes down and they are told.
      </PageHeading>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Owed to creators', inr(owed), 'bg-ink text-white'], ['Ready to send', inr(ready), 'bg-lime'], ['Held (under 2 days)', inr(held), 'bg-lilac-100'], ['Our commission, all time', inr(commission), 'bg-white']].map(([k, v, cls]) => (
          <div key={k} className={`rounded-3xl p-5 shadow-soft ${cls}`}>
            <p className={`text-xs font-semibold ${cls.includes('text-white') ? 'text-white/70' : 'text-ink-500'}`}>{k}</p>
            <p className="mt-2 font-display text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <Tabs label="Show" value={tab} onChange={setTab} tabs={[['owed', 'Owed now'], ['all', 'All creators'], ['history', 'Payments sent']].map(([key, label]) => ({ key, label }))} />

      {tab === 'history' ? (
        history.length === 0 ? <Empty icon={IndianRupee} title="No payouts recorded yet" /> : (
          <Card className="divide-y divide-ink/5">
            <DataTable
              bare
              rows={history}
              minWidth={760}
              columns={[
                { key: 'when', label: 'When', value: (h) => h.created_at, className: 'whitespace-nowrap', render: (h) => when(h.created_at) },
                { key: 'who', label: 'Creator', value: (h) => who(h.user_id)?.email || '', render: (h) => who(h.user_id)?.full_name || who(h.user_id)?.email || h.user_id.slice(0, 8) },
                { key: 'upi', label: 'Sent to', value: (h) => h.upi_id || '', render: (h) => h.upi_id || '—' },
                { key: 'ref', label: 'Reference', value: (h) => h.reference || '', render: (h) => h.reference || '—' },
                { key: 'amt', label: 'Amount', align: 'right', value: (h) => Number(h.amount_inr), className: 'font-semibold', render: (h) => inr(h.amount_inr) },
              ]}
            />
          </Card>
        )
      ) : visible.length === 0 ? <Empty icon={IndianRupee} title="Nobody is owed anything" /> : (
        <Card className="divide-y divide-ink/5">
          <DataTable
            bare
            rows={visible}
            minWidth={1000}
            columns={[
              { key: 'who', label: 'Creator', value: (r) => r.email, className: 'max-w-56 truncate', render: (r) => <span>{r.full_name || r.username || r.email}<span className="block text-xs text-ink-500">{r.email}</span></span> },
              { key: 'upi', label: 'Payout UPI ID', value: (r) => r.upi_id || '', render: (r) => (r.upi_id
                ? <button type="button" onClick={() => copy(r.upi_id)} className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline">{r.upi_id}<Copy className="size-3.5" /></button>
                : <Badge tone="red">Not set</Badge>) },
              { key: 'orders', label: 'Sales', align: 'right', value: (r) => Number(r.orders), render: (r) => `${r.orders} · ${inr(r.gross)}` },
              { key: 'commission', label: 'Our commission', align: 'right', value: (r) => Number(r.commission), render: (r) => inr(r.commission) },
              { key: 'paid', label: 'Paid out', align: 'right', value: (r) => Number(r.paid_out), render: (r) => inr(r.paid_out) },
              { key: 'owed', label: 'Owed', align: 'right', value: (r) => Number(r.balance), className: 'font-semibold', render: (r) => <span>{inr(r.balance)}{Number(r.held) > 0 && <span className="block text-xs font-normal text-ink-500">{inr(r.payable_now)} ready</span>}</span> },
              { key: 'act', label: '', value: () => '', render: (r) => (Number(r.balance) > 0 ? <Button size="sm" onClick={() => openPay(r)}>Record payout</Button> : null) },
            ]}
          />
        </Card>
      )}

      <Modal open={Boolean(pay)} onClose={() => setPay(null)} title={pay ? `Pay ${pay.full_name || pay.email}` : ''}>
        {pay && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-cream p-4 text-sm">
              <p>Send this from your own bank or UPI app, then record it here.</p>
              <p className="mt-2">UPI ID: {pay.upi_id ? <button type="button" onClick={() => copy(pay.upi_id)} className="font-bold underline underline-offset-2">{pay.upi_id}</button> : <b className="text-red-700">not set, ask the creator to add it</b>}{pay.upi_name ? ` (${pay.upi_name})` : ''}</p>
              <p className="mt-1">Owed: <b>{inr(pay.balance)}</b>, ready to send: <b>{inr(pay.payable_now)}</b>.</p>
            </div>
            <Input label="Amount you sent (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input label="UPI reference (UTR)" placeholder="12-digit reference from your payment" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Input label="Note (optional, only you see it)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button>
              <Button loading={busy} disabled={!(Number(amount) > 0)} onClick={record}>Record payout</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
