import { useState } from 'react'
import { Check, Landmark, ShieldCheck } from 'lucide-react'
import { usePlan } from '../../lib/usePlan'
import { KYC_LABEL, kycRefresh, kycStart, usePayouts } from '../../lib/payouts'
import { Alert, Badge, Button, Card, Input, Select, Spinner, useToast } from '../../components/ui'
import { PageHeading } from './DashboardLayout'

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep']
const STEPS = [['Your details', ['created', 'needs_clarification', 'under_review', 'activated']], ['Bank account', ['created', 'needs_clarification', 'under_review', 'activated']], ['Checked by Razorpay', ['activated']], ['Ready to sell', ['activated']]]
const EMPTY = { legal_name: '', business_type: 'individual', pan: '', phone: '', street: '', city: '', state: '', postal_code: '', beneficiary_name: '', bank_account: '', bank_account2: '', ifsc: '' }

function Steps({ status }) {
  const done = (i) => (i === 0 || i === 1 ? ['created', 'needs_clarification', 'under_review', 'activated'].includes(status) : i === 2 ? status === 'activated' : status === 'activated')
  const current = STEPS.findIndex((_, i) => !done(i))
  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {STEPS.map(([label], i) => (
        <li key={label} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${done(i) ? 'bg-lime' : i === current ? 'bg-ink text-white' : 'bg-cream text-ink-500'}`}>
          <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${done(i) ? 'bg-ink text-lime' : 'bg-white/20'}`}>{done(i) ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  )
}

export default function Payouts() {
  const { plan } = usePlan()
  const { loading, route, account, reload } = usePayouts()
  const toast = useToast()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  if (loading || !plan) return <div className="grid h-60 place-items-center"><Spinner /></div>
  const status = account?.status || 'not_started'
  const pct = plan.features?.commission_pct
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
      setError(err.message)
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
      toast(err.message, 'error')
    } finally {
      setBusy(false)
      reload()
    }
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Payouts." italic="Get paid to your bank.">
        Verify yourself once. After that every sale is split automatically: your share goes to your bank account, and our small commission stays with us.
      </PageHeading>

      {!route && <Alert tone="info">Payouts are opening soon. Until then you can keep using the page, and nothing you have built is lost.</Alert>}

      <Card className="space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">Your payout account</h2>
          <Badge tone={status === 'activated' ? 'green' : status === 'rejected' || status === 'suspended' ? 'red' : 'neutral'}>{KYC_LABEL[status]}</Badge>
        </div>
        <Steps status={status} />

        {status === 'activated' && account && (
          <div className="rounded-2xl bg-cream p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> You are verified. Paid products, sessions and tips are switched on.</p>
            <p className="mt-2 text-ink-600">Payouts go to <b>{account.beneficiary_name}</b>, account ending <b>{account.bank_last4}</b> ({account.bank_ifsc}). To change the bank account, message us from Messages.</p>
          </div>
        )}
        {status === 'under_review' && (
          <Alert tone="info">Razorpay is checking your details. This usually takes a few hours to 2 working days. We will email you when it is done.
            <div className="mt-2"><Button size="sm" variant="outline" loading={busy} onClick={refresh}>Check status</Button></div>
          </Alert>
        )}
        {status === 'needs_clarification' && (
          <Alert>
            Razorpay needs a little more to finish. {account?.requirements?.length ? 'It asked for: ' + account.requirements.map((r) => String(r.field || r.reason || '').replace(/_/g, ' ')).filter(Boolean).join(', ') + '.' : ''} Correct your details below and send them again.
          </Alert>
        )}
        {(status === 'rejected' || status === 'suspended') && <Alert>Razorpay could not approve this account{account?.reason ? `: ${account.reason}` : '.'} Message us from Messages and we will help.</Alert>}
      </Card>

      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">How you get paid</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-700">
          <li>A buyer pays once on your page, by UPI, card or net banking.</li>
          <li>Razorpay splits it right away: <b>{pct != null ? `${pct}%` : 'a small commission'}</b> goes to Joinlyy (your plan decides it: Starter 15%, Creator 10%, Pro 5%), the rest is yours.</li>
          <li>Your share is held for 2 days so a refund is still possible, then Razorpay sends it to your bank account.</li>
        </ol>
        <p className="mt-3 text-xs text-ink-500">Free things, and brand products or courses sold on another website, never need this.</p>
      </Card>

      {canFill && (
        <Card className="p-5 sm:p-7">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Landmark className="size-5" /> Your details</h2>
          <p className="mt-1 text-sm text-ink-500">We send these straight to Razorpay for verification. We do not keep your PAN or your full account number.</p>
          <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Full name (as on PAN)" value={f.legal_name} onChange={set('legal_name')} required disabled={!route} />
            <Select label="You sell as" value={f.business_type} onChange={set('business_type')} disabled={!route} options={[{ value: 'individual', label: 'An individual' }, { value: 'proprietorship', label: 'A proprietorship or business' }]} />
            <Input label="PAN" placeholder="ABCDE1234F" maxLength={10} value={f.pan} onChange={(e) => setF((x) => ({ ...x, pan: e.target.value.toUpperCase() }))} required disabled={!route} />
            <Input label="Mobile number" inputMode="numeric" placeholder="10 digits" maxLength={13} value={f.phone} onChange={set('phone')} required disabled={!route} />
            <Input className="sm:col-span-2" label="Address" value={f.street} onChange={set('street')} required disabled={!route} />
            <Input label="City" value={f.city} onChange={set('city')} required disabled={!route} />
            <Select label="State" value={f.state} onChange={set('state')} disabled={!route} options={[{ value: '', label: 'Choose a state', disabled: true }, ...STATES.map((s) => ({ value: s, label: s }))]} required />
            <Input label="PIN code" inputMode="numeric" maxLength={6} value={f.postal_code} onChange={set('postal_code')} required disabled={!route} />
            <div className="hidden sm:block" />
            <Input label="Name on bank account" value={f.beneficiary_name} onChange={set('beneficiary_name')} required disabled={!route} />
            <Input label="IFSC" placeholder="HDFC0001234" maxLength={11} value={f.ifsc} onChange={(e) => setF((x) => ({ ...x, ifsc: e.target.value.toUpperCase() }))} required disabled={!route} />
            <Input label="Bank account number" inputMode="numeric" value={f.bank_account} onChange={set('bank_account')} required disabled={!route} />
            <Input label="Type the account number again" inputMode="numeric" value={f.bank_account2} onChange={set('bank_account2')} required disabled={!route} />
            {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
            <div className="sm:col-span-2">
              <Button type="submit" loading={busy} disabled={!route}>Send for verification</Button>
              <p className="mt-2 text-xs text-ink-500">By sending, you agree to Razorpay’s terms for receiving payments and confirm these details are yours.</p>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
