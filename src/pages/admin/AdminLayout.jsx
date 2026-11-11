import { Link, NavLink, Outlet } from 'react-router-dom'
import { ArrowLeft, Ban, Crown, Flag, Gauge, LogOut, MessagesSquare, Receipt, Scale, ScrollText, ShieldAlert, Users, IndianRupee } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../../components/icons'
import { APP_NAME } from '../../lib/config'
import PasswordBanner from '../../components/SetPassword'

const NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/creators', label: 'Creators', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/messages', label: 'Messages', icon: MessagesSquare },
  { to: '/admin/orders', label: 'Orders', icon: Receipt },
  { to: '/admin/disputes', label: 'Disputes', icon: Scale },
  { to: '/admin/fraud', label: 'Fraud flags', icon: ShieldAlert },
  { to: '/admin/plans', label: 'Plans & pricing', icon: Crown },
  { to: '/admin/payments', label: 'Plan payments', icon: IndianRupee },
  { to: '/admin/domains', label: 'Domains & links', icon: Ban },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col gap-4 p-3 sm:p-4 lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-3 rounded-3xl bg-ink p-4 text-white lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:w-[260px]">
        <div className="flex items-center justify-between gap-3 px-1 lg:pt-1 lg:pb-5">
          <Link to="/admin" className="flex items-center gap-3">
            <span className="rounded-full ring-2 ring-lime"><Logo size={40} /></span>
            <span>
              <span className="block font-display text-lg leading-tight font-semibold">{APP_NAME}</span>
              <span className="block text-xs font-semibold tracking-widest text-lime uppercase">Super admin</span>
            </span>
          </Link>
          <button type="button" onClick={signOut} className="grid size-10 place-items-center rounded-full bg-white/10 lg:hidden" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
        <nav className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-1 lg:flex-col lg:px-0" aria-label="Admin">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium transition ${isActive ? 'bg-lime text-ink' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <n.icon className="size-[18px]" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden rounded-2xl bg-white/5 p-3 lg:block">
          <p className="truncate text-sm font-semibold">{profile?.full_name || 'Admin'}</p>
          <p className="truncate text-xs text-white/50">{profile?.email}</p>
          <div className="mt-2 flex gap-3 text-xs font-semibold text-white/70">
            <Link to="/dashboard" className="inline-flex items-center gap-1 hover:text-white"><ArrowLeft className="size-3.5" /> My page</Link>
            <button type="button" onClick={signOut} className="inline-flex items-center gap-1 hover:text-white"><LogOut className="size-3.5" /> Sign out</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 space-y-4">
        <PasswordBanner />
        <Outlet />
      </main>
    </div>
  )
}
