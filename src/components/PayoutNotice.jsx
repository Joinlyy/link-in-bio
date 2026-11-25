import { Link } from 'react-router-dom'
import { Landmark } from 'lucide-react'
import { usePayouts } from '../lib/payouts'

/** Shown wherever money is involved: paid products need a verified payout account first */
export default function PayoutNotice({ className = '' }) {
  const { loading, route, canSell } = usePayouts()
  if (loading || canSell) return null
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-3xl bg-lime px-5 py-4 text-sm ${className}`} role="status">
      <Landmark className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{route ? <><b>Verify your payout account to sell.</b> Free things work now. Paid products, sessions and tips switch on once your KYC is done.</> : <><b>Add your payout UPI ID to sell.</b> Free things work now. Paid products, sessions and tips switch on once we know where to send your earnings.</>}</span>
      <Link to="/dashboard/payouts" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-bold text-white">{route ? 'Set up payouts' : 'Add UPI ID'}</Link>
    </div>
  )
}
