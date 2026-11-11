import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, BriefcaseBusiness, Check, Copy, ExternalLink, BookOpen, CircleHelp, House, Layers, LayoutList, LoaderCircle, LogOut,
  Settings, ShieldCheck, ShoppingBag, Users,
  ChevronsUpDown, Plus, Eye,
} from 'lucide-react'
import { Avatar } from '../../components/page/PageRenderer'
import { supabase } from '../../lib/supabase'
import InstallAppButton from '../../components/InstallApp'
import PasswordBanner from '../../components/SetPassword'
import { useAuth } from '../../context/AuthContext'
import { PageProvider, usePage } from '../../context/PageContext'
import { Brand } from '../../components/SiteChrome'
import { Button, FieldHelpContext, FullScreenLoader, Modal, Toggle, useToast } from '../../components/ui'
import { helpFor, pageHelpFor } from '../../lib/help'
import { INSTAGRAM_ENABLED, pageDisplayUrl, pageUrl } from '../../lib/config'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: House, end: true },
  {
    to: '/dashboard/editor', label: 'Website', icon: LayoutList,
    tabs: [['/dashboard/editor', 'Pages'], ['/dashboard/appearance', 'Design'], ['/dashboard/templates', 'Templates']],
  },
  {
    to: '/dashboard/products', label: 'Products', icon: ShoppingBag,
    tabs: [['/dashboard/products', 'Products'], ['/dashboard/sales', 'Sales']],
  },
  { to: '/dashboard/content', label: 'Content & forms', icon: Layers },
  {
    to: '/dashboard/deals', label: 'Brand', icon: BriefcaseBusiness,
    tabs: [['/dashboard/deals', 'Collabs'], ['/dashboard/brand-form', 'Brand form'], ['/dashboard/invoices', 'Invoices'], ['/dashboard/media-kit', 'Media kit']],
  },
  {
    to: '/dashboard/audience', label: 'Audience', icon: Users,
    tabs: [['/dashboard/audience', 'Everyone'], ['/dashboard/leads', 'Leads'], ...(INSTAGRAM_ENABLED ? [['/dashboard/automations', 'DM automation']] : [])],
  },
  { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  {
    to: '/dashboard/settings', label: 'Settings', icon: Settings,
    tabs: [['/dashboard/settings', 'Settings'], ['/dashboard/team', 'Team'], ['/dashboard/billing', 'Plan'], ['/dashboard/referrals', 'Refer & earn'], ['/dashboard/messages', 'Messages']],
  },
  { to: '/dashboard/guide', label: 'Guide', icon: BookOpen },
]

const activeGroup = (path) =>
  NAV.find((n) => n.tabs?.some(([to]) => path === to || path.startsWith(`${to}/`)))

/** Keeps the current tab visible in a row that scrolls sideways */
function useActiveInView() {
  const { pathname } = useLocation()
  const ref = useRef(null)
  useEffect(() => {
    const row = ref.current
    const tab = row?.querySelector('[data-current="true"]')
    if (tab) row.scrollTo({ left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2, behavior: 'instant' })
  }, [pathname])
  return ref
}

function SubTabs() {
  const { pathname } = useLocation()
  const group = activeGroup(pathname)
  const ref = useActiveInView()
  if (!group) return null
  return (
    <nav ref={ref} className="scrollbar-none relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-soft" aria-label={group.label}>
      {group.tabs.map(([to, label]) => (
        <NavLink key={to} to={to} data-current={pathname === to} className={({ isActive }) => `h-9 shrink-0 rounded-full px-4 text-sm leading-9 font-semibold transition ${isActive ? 'bg-ink text-white' : 'text-ink-600 hover:text-ink'}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function MainNavLink({ n, mobile }) {
  const { pathname } = useLocation()
  const inGroup = activeGroup(pathname) === n
  return (
    <NavLink
      to={n.to}
      end={n.end}
      data-current={inGroup || pathname === n.to}
      className={({ isActive }) =>
        mobile
          ? `flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${isActive || inGroup ? 'bg-ink text-white' : 'bg-white text-ink-600 shadow-soft'}`
          : `flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium transition ${isActive || inGroup ? 'bg-ink text-white' : 'text-ink-600 hover:bg-cream hover:text-ink'}`
      }
    >
      <n.icon className={mobile ? 'size-4' : 'size-[18px]'} />
      {n.label}
    </NavLink>
  )
}

function MobileNav({ isAdmin }) {
  const ref = useActiveInView()
  return (
    <nav ref={ref} className="scrollbar-none sticky top-0 z-30 -mx-3 -my-2 flex gap-1.5 overflow-x-auto bg-cream px-3 py-2 sm:-mx-4 sm:px-4 lg:hidden" aria-label="Dashboard sections">
      {NAV.map((n) => <MainNavLink key={n.to} n={n} mobile />)}
      <div className="shrink-0 [&>*]:mt-0"><InstallAppButton /></div>
      {isAdmin && (
        <Link to="/admin" className="flex shrink-0 items-center gap-2 rounded-full bg-lilac-100 px-4 py-2.5 text-sm font-semibold">
          <ShieldCheck className="size-4" /> Admin
        </Link>
      )}
    </nav>
  )
}

function CopyUrl({ username }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(pageUrl(username)).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex min-w-0 items-center gap-2 rounded-full bg-cream py-2 pr-2 pl-4 text-sm font-medium transition hover:bg-cream-300"
      title="Copy link"
    >
      <span className="truncate">{pageDisplayUrl(username)}</span>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </span>
    </button>
  )
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

/** Switch between the pages you own or manage as a team member */
function PageSwitcher({ compact = false }) {
  const { pages, page, role, selectPage } = usePage()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full min-w-0 items-center gap-2.5 rounded-2xl text-left transition hover:bg-cream ${compact ? 'p-1 pr-2' : 'bg-cream/60 p-2'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Avatar page={page} size={compact ? 30 : 36} theme={page.theme} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{page.display_name || page.username}</span>
          {!compact && <span className="block truncate text-xs text-ink-500">/{page.username} · {ROLE_LABEL[role]}</span>}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] animate-fade-up rounded-3xl bg-white p-2 shadow-lift ring-1 ring-ink/5" role="listbox">
          <p className="eyebrow px-3 pt-2 pb-1 text-ink-400">Your pages</p>
          <div className="max-h-72 overflow-y-auto">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === page.id}
                onClick={() => {
                  setOpen(false)
                  if (p.id !== page.id) selectPage(p.id)
                }}
                className={`flex w-full items-center gap-2.5 rounded-2xl p-2 text-left hover:bg-cream ${p.id === page.id ? 'bg-cream' : ''}`}
              >
                <Avatar page={p} size={32} theme={p.theme} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.display_name || p.username}</span>
                  <span className="block truncate text-xs text-ink-500">/{p.username}{p.owner_id !== user.id && ' · Team'}</span>
                </span>
                {p.id === page.id && <Check className="size-4" />}
              </button>
            ))}
          </div>
          <Link to="/onboarding?new=1" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-2xl p-2.5 text-sm font-semibold hover:bg-cream">
            <span className="grid size-8 place-items-center rounded-full bg-lime"><Plus className="size-4" /></span>
            Create another page
          </Link>
        </div>
      )}
    </div>
  )
}

/** Payments buyers have sent, waiting for the creator to check */
function UpiWaitingBanner() {
  const { page } = usePage()
  const { pathname } = useLocation()
  const [count, setCount] = useState(0)
  useEffect(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('page_id', page.id).eq('payment_provider', 'upi').eq('status', 'pending').not('payment_ref', 'is', null)
      .then(({ count: n }) => setCount(n || 0))
  }, [page.id, pathname])
  if (!count || pathname === '/dashboard/sales') return null
  return (
    <Link to="/dashboard/sales" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-lime px-4 py-3 text-sm">
      <span><b>{count} UPI payment{count === 1 ? '' : 's'} to confirm.</b> Buyers are waiting for access.</span>
      <span className="font-semibold underline underline-offset-2">Check now</span>
    </Link>
  )
}

/** Says plainly that visitors can't see the page yet, with the one button that fixes it */
function DraftBanner() {
  const { page, updatePage } = usePage()
  const toast = useToast()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200">
      <p className="min-w-0 flex-1 basis-60">
        <b>Your page is private.</b> Visitors who open {pageDisplayUrl(page.username)} see “page not found” until you make it live.
      </p>
      <Button
        size="sm"
        onClick={() => {
          updatePage({ is_published: true }, { immediate: true })
          toast('Your page is live!')
        }}
      >
        Make it live
      </Button>
    </div>
  )
}

function PublishSwitch() {
  const { page, updatePage, canEdit } = usePage()
  const toast = useToast()
  return (
    <div className="flex items-center gap-2.5 rounded-full bg-cream py-1.5 pr-2 pl-4">
      <span className={`text-sm font-semibold ${page.is_published ? 'text-teal' : 'text-ink-500'}`}>{page.is_published ? 'Live' : 'Draft'}</span>
      <Toggle
        checked={page.is_published}
        disabled={!canEdit}
        onChange={(v) => {
          updatePage({ is_published: v }, { immediate: true })
          toast(v ? 'Your page is live!' : 'Page unpublished')
        }}
      />
    </div>
  )
}

function Shell() {
  const { page, status, saving, canEdit } = usePage()
  const { profile, isAdmin, signOut } = useAuth()

  if (status === 'loading') return <FullScreenLoader />
  if (status === 'none') return <Navigate to="/onboarding" replace />
  if (status === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-semibold">We couldn’t load your dashboard.</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] gap-4 p-3 sm:p-4">
      {/* Sidebar (desktop) */}
      <aside className="card sticky top-4 hidden h-[calc(100dvh-2rem)] w-[260px] shrink-0 flex-col p-4 lg:flex">
        <div className="px-2 pt-1 pb-3">
          <Brand to="/dashboard" />
        </div>
        <PageSwitcher />
        <nav className="scrollbar-none -mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1" aria-label="Dashboard">
          {NAV.map((n) => <MainNavLink key={n.to} n={n} />)}
          {isAdmin && (
            <Link to="/admin" className="mt-2 flex items-center gap-3 rounded-2xl bg-lilac-100 px-4 py-3 text-[15px] font-semibold">
              <ShieldCheck className="size-[18px]" /> Super admin
            </Link>
          )}
          <InstallAppButton />
        </nav>
        <div className="rounded-2xl bg-cream p-3">
          <p className="truncate text-sm font-semibold">{profile?.full_name || page.display_name || page.username}</p>
          <p className="truncate text-xs text-ink-500">{profile?.email}</p>
          <button type="button" onClick={signOut} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink">
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <PasswordBanner />

        {/* Top bar */}
        <header className="card z-40 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5 lg:sticky lg:top-4">
          <div className="min-w-0 flex-1 lg:hidden">
            <div className="w-fit max-w-full"><PageSwitcher compact /></div>
          </div>
          <div className="order-last flex w-full min-w-0 items-center gap-2 lg:order-none lg:w-auto lg:flex-1">
            <CopyUrl username={page.username} />
            <a href={`/${page.username}`} target="_blank" rel="noreferrer" className="grid size-10 shrink-0 place-items-center rounded-full bg-cream hover:bg-cream-300" aria-label="Open page">
              <ExternalLink className="size-4" />
            </a>
            <span className="hidden items-center gap-1.5 text-xs text-ink-500 sm:inline-flex">
              {saving ? <><LoaderCircle className="size-3.5 animate-spin" /> Saving…</> : <><Check className="size-3.5" /> Saved</>}
            </span>
          </div>
          <PublishSwitch />
          <button type="button" onClick={signOut} className="grid size-10 shrink-0 place-items-center rounded-full bg-cream lg:hidden" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </header>

        {/* Mobile nav stays reachable while scrolling */}
        <MobileNav isAdmin={isAdmin} />

        {canEdit && !page.is_published && <DraftBanner />}
        {canEdit && <UpiWaitingBanner />}

        {!canEdit && (
          <div className="flex items-center gap-2 rounded-2xl bg-lilac-100 px-4 py-3 text-sm font-medium">
            <Eye className="size-4" /> You have view-only access to this page.
          </div>
        )}

        {/* No transform animation here: it would trap every fixed popup and button inside this box */}
        <main className="min-w-0 flex-1 space-y-4" key={page.id}>
          <SubTabs />
          <FieldHelpContext.Provider value={helpFor}>
            <Outlet />
          </FieldHelpContext.Provider>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout() {
  return (
    <PageProvider>
      <Shell />
    </PageProvider>
  )
}

function PageHelp() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const help = pageHelpFor(pathname)
  if (!help) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-ink-600 shadow-soft hover:text-ink" aria-label={`How ${help.title} works`}>
        <CircleHelp className="size-[18px]" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={help.title}>
        <p className="text-[15px] leading-relaxed text-ink-700">{help.what}</p>
        <ol className="mt-4 space-y-2.5">
          {help.steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lime text-xs font-bold">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        {help.tip && <p className="mt-4 rounded-2xl bg-lilac-100 p-4 text-sm leading-relaxed"><b>Tip:</b> {help.tip}</p>}
        {help.link && <Link to={help.link.to} onClick={() => setOpen(false)} className="mt-4 inline-block text-sm font-semibold underline underline-offset-2">{help.link.label}</Link>}
      </Modal>
    </>
  )
}

export function PageHeading({ title, italic, children, actions }) {
  return (
    <div className="mb-4 flex flex-col gap-3 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pt-2">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <h1 className="min-w-0 font-display text-[28px] leading-[1.05] font-bold tracking-[-0.02em] sm:text-[40px]">
            {title} {italic && <span className="display-italic">{italic}</span>}
          </h1>
          <PageHelp />
        </div>
        {children && <p className="mt-2 max-w-2xl text-[15px] text-ink-500">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
