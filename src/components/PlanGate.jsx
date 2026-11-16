import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

/**
 * "This is on Creator and Pro" note with a link to the plans page.
 * The database enforces every limit; this only explains it before the creator hits an error.
 */
export function UpgradeNote({ children, compact = false, className = '' }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl bg-lime-200 px-4 ${compact ? 'py-2.5 text-xs' : 'py-3 text-sm'} font-medium text-ink ${className}`}>
      <Sparkles className={`${compact ? 'size-3.5' : 'size-4'} mt-0.5 shrink-0`} />
      <div className="min-w-0">
        {children}{' '}
        <Link to="/dashboard/billing" className="font-semibold whitespace-nowrap underline underline-offset-2">See plans</Link>
      </div>
    </div>
  )
}

/** Small "Creator" tag for options that need a paid plan */
export function PlanTag({ children = 'Creator' }) {
  return <span className="ml-1.5 inline-flex rounded-full bg-lime px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase">{children}</span>
}
