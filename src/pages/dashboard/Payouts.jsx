import { useEffect, useState } from 'react'
import { Check, Landmark, ShieldCheck } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { usePlan } from '../../lib/usePlan'
import { KYC_LABEL, kycRefresh, kycStart, usePayouts } from '../../lib/payouts'
import { Alert, Badge, Button, Card, Input, Select, Spinner, useToast } from '../../components/ui'
import { PageHeading } from './DashboardLayout'
import { BillingCard } from './Invoices'

const UPI_RE = /^[a-zA-Z0-9._-]{2,255}@[a-zA-Z0-9]{2,64}$/
const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Where we send the creator's earnings */
function UpiCard() {
  const { page, updatePage, canEdit } = usePage()
  const { reload } = usePayouts()
  const toast = useToast()
  const [upi, setUpi] = useState(page.upi_id || '')
  const [name, setName] = useState(page.upi_name || page.display_name || '')
  const clean = upi.trim()
  const wrong = clean && !UPI_RE.test(clean)
  const changed = clean !== (page.upi_id || '') || name.trim() !== (page.upi_name || '')

  async function save() {
    await updatePage({ upi_id: clean || null, upi_name: name.trim() || null }, { immediate: true })
    toast(clean ? 'Saved. We will send your earnings to this UPI ID.' : 'Payout UPI ID removed. Paid products are switched off until you add one.')
    reload()
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Your payout UPI ID</h2>
        {page.upi_id ? <Badge tone="green">Set</Badge> : <Badge>Not set</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-500">Your earnings, after our platform charge, are sent to this UPI ID within 2 working days of each sale. Paid products, sessions and tips work only once it is set.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Input label="UPI ID" placeholder="yourname@okhdfcbank" value={upi} disabled={!canEdit} error={wrong ? 'A UPI ID looks like name@bank, for example priya@okaxis' : undefined} onChange={(e) => setUpi(e.target.value)} />
        <Input label="Name on that UPI account" maxLength={80} placeholder="As it appears in your bank" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
      </div>
      {canEdit && <div className="mt-4"><Button onClick={save} disabled={!changed || wrong}>Save</Button></div>}
    </Card>
  )
}

function Tile({ label, value, cls = 'bg-white', note }) {
  return (
    <div className={`rounded-3xl p-5 shadow-soft ${cls}`}>
      <p className={`text-xs font-semibold ${cls.includes('text-white') ? 'text-white/70' : 'text-ink-500'}`}>{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {note && <p className={`mt-1 text-xs ${cls.includes('text-white') ? 'text-white/60' : 'text-ink-500'}`}>{note}</p>}
    </div>
  )
}

/** Two working days after the sale (Saturday and Sunday do not count) */
function expectedBy(paidAt) {
  const d = new Date(paidAt)
  let left = 2
  while (left > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) left--
  }
  return d
}

function Earnings({ plan }) {
  const { user } = useAuth()
  const { page } = usePage()
  const [e, setE] = useState(null)
  const [history, setHistory] = useState(null)
  const [sales, setSales] = useState(null)
  useEffect(() => {
    supabase.rpc('my_earnings').then(({ data }) => setE(data || {}))
    supabase.from('creator_payouts').select('id, amount_inr, upi_id, reference, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50).then(({ data }) => setHistory(data || []))
    supabase.from('orders').select('id, kind, product_title, amount_inr, commission_pct, commission_inr, creator_share_inr, paid_at').eq('page_id', page.id).eq('payment_provider', 'razorpay').eq('status', 'paid').order('paid_at', { ascending: true }).limit(500).then(({ data }) => setSales(data || []))
  }, [user.id, page.id])
  if (!e || !history || !sales) return <div className="grid h-32 place-items-center"><Spinner /></div>
  const pct = plan?.features?.commission_pct

  // Payouts cover the oldest sales first
  let left = Number(e.paid_out)
  const rows = sales.map((o) => {
    const share = Number(o.creator_share_inr)
    const sent = left >= share - 0.005
    if (sent) left -= share
    return { ...o, sent }
  }).reverse()

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="You earned today" value={formatInr(e.today_share)} cls="bg-lime" note={e.today_orders > 0 ? `${e.today_orders} sale${e.today_orders === 1 ? '' : 's'}, buyers paid ${formatInr(e.today_gross)}` : 'No sales yet today'} />
        <Tile label="On its way to you" value={formatInr(e.balance)} cls="bg-ink text-white" note="Sent to your UPI ID within 2 working days of each sale" />
        <Tile label="Sent to you so far" value={formatInr(e.paid_out)} cls="bg-lilac-100" />
        <Tile label="Platform charge so far" value={formatInr(e.commission)} note={`${pct != null ? `${pct}% of sales, ` : ''}buyers paid ${formatInr(e.gross)} in total`} />
      </div>

      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">How every sale is split</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-700">
          <li>A buyer pays the price you set. That price is final: we add nothing on top, so include GST in it if it applies to you.</li>
          <li>Joinlyy keeps a platform charge of <b>{pct != null ? `${pct}%` : 'a small percentage'}</b> (Starter 15%, Creator 10%, Pro 5%).</li>
          <li>The rest is your earning. It is sent to your UPI ID within 2 working days of the sale, and you get an email each time.</li>
        </ol>
      </Card>

      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">Your sales</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Paid sales appear here with the full split.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-500">
                  <th className="py-2 pr-3">Sale</th>
                  <th className="py-2 pr-3 text-right">Buyer paid</th>
                  <th className="py-2 pr-3 text-right">Platform charge</th>
                  <th className="py-2 pr-3 text-right">You receive</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 pr-3"><span className="font-medium">{o.product_title || (o.kind === 'tip' ? 'Tip' : 'Order')}</span><span className="block text-xs text-ink-500">{day(o.paid_at)}</span></td>
                    <td className="py-2.5 pr-3 text-right">{formatInr(o.amount_inr)}</td>
                    <td className="py-2.5 pr-3 text-right text-ink-600">− {formatInr(o.commission_inr)}{o.commission_pct != null ? ` (${Number(o.commission_pct)}%)` : ''}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{formatInr(o.creator_share_inr)}</td>
                    <td className="py-2.5">{o.sent ? <Badge tone="green">Sent</Badge> : <span className="text-xs text-ink-600">By {day(expectedBy(o.paid_at))}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">Payout history</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Nothing has been sent yet. Your first payout appears here.</p>
        ) : (
          <div className="mt-3 divide-y divide-ink/5">
            {history.map((h) => (
              <div key={h.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{formatInr(h.amount_inr)}</p>
                  <p className="text-sm text-ink-500">{day(h.created_at)}{h.upi_id ? ` · to ${h.upi_id}` : ''}{h.reference ? ` · ref ${h.reference}` : ''}</p>
                </div>
                <Badge tone="green">Sent</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

// ---------- Razorpay Route KYC (shown only once Route is switched on) ----------
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep']
const EMPTY = { legal_name: '', business_type: 'individual', pan: '', phone: '', street: '', city: '', state: '', postal_code: '', beneficiary_name: '', bank_account: '', bank_account2: '', ifsc: '' }

function KycCard() {
  const { account, reload } = usePayouts()
  const toast = useToast()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const status = account?.status || 'not_started'
  const canFill = ['not_started', 'created', 'needs_clarification', 'rejected'].includes(status)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (f.bank_account !== f.bank_account2) return setError('The two bank account numbers do not match')
    setBusy(true)
    try {
      const { bank_account2, ...fields } = f
      const r = await kycStart(fields)
      setF(EMPTY)
      toast(r.status === 'activated' ? 'Your payout account is verified' : 'Details sent. Razorpay is checking them.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
      reload()
    }
  }
  async function refresh() {
    setBusy(true)
    try {
      await kycRefresh()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
      reload()
    }
  }

  return (
    <Card className="space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Landmark className="size-5" /> Verify for instant payouts</h2>
        <Badge tone={status === 'activated' ? 'green' : status === 'rejected' || status === 'suspended' ? 'red' : 'neutral'}>{KYC_LABEL[status]}</Badge>
      </div>
      {status === 'activated' && account && (
        <p className="flex items-center gap-2 rounded-2xl bg-cream p-4 text-sm font-semibold"><ShieldCheck className="size-4" /> Verified. Your share now goes to {account.beneficiary_name}, account ending {account.bank_last4}, at the time of each sale.</p>
      )}
      {status === 'under_review' && (
        <Alert tone="info">Razorpay is checking your details. <Button size="sm" variant="outline" loading={busy} onClick={refresh}>Check status</Button></Alert>
      )}
      {status === 'needs_clarification' && <Alert>Razorpay needs a little more. Correct your details below and send them again.</Alert>}
      {(status === 'rejected' || status === 'suspended') && <Alert>Razorpay could not approve this account{account?.reason ? `: ${account.reason}` : '.'}</Alert>}
      {canFill && (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name (as on PAN)" value={f.legal_name} onChange={set('legal_name')} required />
          <Select label="You sell as" value={f.business_type} onChange={set('business_type')} options={[{ value: 'individual', label: 'An individual' }, { value: 'proprietorship', label: 'A proprietorship or business' }]} />
          <Input label="PAN" placeholder="ABCDE1234F" maxLength={10} value={f.pan} onChange={(e) => setF((x) => ({ ...x, pan: e.target.value.toUpperCase() }))} required />
          <Input label="Mobile number" inputMode="numeric" maxLength={13} value={f.phone} onChange={set('phone')} required />
          <Input className="sm:col-span-2" label="Address" value={f.street} onChange={set('street')} required />
          <Input label="City" value={f.city} onChange={set('city')} required />
          <Select label="State" value={f.state} onChange={set('state')} options={[{ value: '', label: 'Choose a state', disabled: true }, ...STATES.map((s) => ({ value: s, label: s }))]} required />
          <Input label="PIN code" inputMode="numeric" maxLength={6} value={f.postal_code} onChange={set('postal_code')} required />
          <div className="hidden sm:block" />
          <Input label="Name on bank account" value={f.beneficiary_name} onChange={set('beneficiary_name')} required />
          <Input label="IFSC" placeholder="HDFC0001234" maxLength={11} value={f.ifsc} onChange={(e) => setF((x) => ({ ...x, ifsc: e.target.value.toUpperCase() }))} required />
          <Input label="Bank account number" inputMode="numeric" value={f.bank_account} onChange={set('bank_account')} required />
          <Input label="Type the account number again" inputMode="numeric" value={f.bank_account2} onChange={set('bank_account2')} required />
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
          <div className="sm:col-span-2"><Button type="submit" loading={busy}>Send for verification</Button></div>
        </form>
      )}
    </Card>
  )
}

/** The seller details printed on every sale's invoice. A GSTIN makes it a GST invoice; without one, no GST is shown. */
function TaxCard() {
  const { page, updatePage, canEdit } = usePage()
  const toast = useToast()
  return (
    <div className="space-y-3">
      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">Tax and invoice details</h2>
        <p className="mt-1 text-sm text-ink-500">
          Every paid sale gets an invoice for your buyer. Add your business name, address and <b>GSTIN</b> and the invoice becomes a GST invoice: the price the buyer paid is split into the taxable value, CGST and SGST.
          If you are not GST-registered, leave the GSTIN empty and the invoice shows no GST at all.
        </p>
      </Card>
      <BillingCard
        key={JSON.stringify(page.billing || {})}
        billing={page.billing || {}}
        canEdit={canEdit}
        onSave={async (billing) => {
          await updatePage({ billing }, { immediate: true })
          toast('Saved. New sales will use these details.')
        }}
      />
    </div>
  )
}

export default function Payouts() {
  const { plan } = usePlan()
  const { loading, route } = usePayouts()
  if (loading || !plan) return <div className="grid h-60 place-items-center"><Spinner /></div>
  return (
    <div className="space-y-4">
      <PageHeading title="Payouts." italic="Get paid to your UPI.">
        Everything buyers pay you, minus our commission, sent to your UPI ID.
      </PageHeading>
      <UpiCard />
      <Earnings plan={plan} />
      <TaxCard />
      {route && <KycCard />}
    </div>
  )
}
