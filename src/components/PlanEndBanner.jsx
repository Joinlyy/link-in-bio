import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../lib/usePlan'
import { PLAN_NAME } from '../lib/plans'

const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
const DAY = 86400_000

/**
 * Tells a creator when their paid plan ends (from 3 days before) and, for 10 days after, that it has ended.
 * Plans that renew by themselves show nothing.
 */
export default function PlanEndBanner() {
  const { user } = useAuth()
  const { plan } = usePlan()
  const [auto, setAuto] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('billing_subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').eq('cancel_at_cycle_end', false).limit(1)
      .then(({ data }) => setAuto(Boolean(data?.length)))
  }, [user])

  if (!plan || auto === null || auto || !plan.expires_at) return null
  const ends = new Date(plan.expires_at).getTime()
  const now = Date.now()
  const left = ends - now
  const soon = plan.plan !== 'free' && left > 0 && left <= 3 * DAY
  const ended = left <= 0 && now - ends <= 10 * DAY
  if (!soon && !ended) return null

  const name = PLAN_NAME[plan.plan === 'free' ? 'pro' : plan.plan] || 'paid'
  const days = Math.max(1, Math.ceil(left / DAY))
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${ended ? 'bg-rose text-white' : 'bg-lime text-ink'}`} role="status">
      <Clock className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {ended
          ? <>Your plan ended on <b>{day(ends)}</b>. Renew to switch your paid features back on.</>
          : <>Your subscription ends on <b>{day(ends)}</b>{days === 1 ? ' (today or tomorrow)' : ` (in ${days} days)`}. Renew to keep your {name} features.</>}
      </span>
      <Link to="/dashboard/billing" className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-bold ${ended ? 'bg-white text-ink' : 'bg-ink text-white'}`}>Renew now</Link>
    </div>
  )
}
