import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Mail, Trash2, UsersRound } from 'lucide-react'
import { usePage } from '../../context/PageContext'
import { useAuth } from '../../context/AuthContext'
import { errorMessage, supabase } from '../../lib/supabase'
import { useOwnerFeatures } from '../../lib/usePlan'
import { APP_NAME } from '../../lib/config'
import { Alert, Badge, Button, Card, Empty, Input, Select, Spinner, useToast, askConfirm } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from './DashboardLayout'

const ROLES = [
  { value: 'admin', label: 'Admin', desc: 'Everything, including inviting people' },
  { value: 'editor', label: 'Editor', desc: 'Edit the page, products, deals and leads' },
  { value: 'viewer', label: 'Viewer', desc: 'See analytics, sales and leads only' },
]

export default function Team() {
  const [view, setView] = useViewMode('team')
  const { page, role, isOwner, reload } = usePage()
  const { user } = useAuth()
  const toast = useToast()
  const features = useOwnerFeatures(page.owner_id)
  const [members, setMembers] = useState(null)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState('editor')
  const [busy, setBusy] = useState(false)
  const canManage = role === 'owner' || role === 'admin'

  const load = useCallback(async () => {
    const { data } = await supabase.from('page_members').select('*').eq('page_id', page.id).order('created_at')
    setMembers(data || [])
  }, [page.id])
  useEffect(() => {
    load()
  }, [load])

  const max = features?.max_team ?? 0
  const full = members && members.length >= max

  async function invite(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('page_members').insert({ page_id: page.id, email: email.trim().toLowerCase(), role: newRole })
    setBusy(false)
    if (error) return toast(/page_members_page_id_email_key/.test(error.message) ? 'That person is already invited' : errorMessage(error), 'error')
    setEmail('')
    toast('Invite added — they get access as soon as they sign in with that email')
    load()
  }

  async function changeRole(m, r) {
    const { error } = await supabase.from('page_members').update({ role: r }).eq('id', m.id)
    if (error) return toast(errorMessage(error), 'error')
    setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, role: r } : x)))
  }

  async function remove(m) {
    if (!(await askConfirm({ title: 'Remove this team member?', message: m.email, confirmLabel: 'Remove' }))) return
    const { error } = await supabase.from('page_members').delete().eq('id', m.id)
    if (error) return toast(errorMessage(error), 'error')
    setMembers((list) => list.filter((x) => x.id !== m.id))
    toast('Removed')
  }

  async function leave() {
    const mine = members.find((m) => m.user_id === user.id)
    if (!mine || !(await askConfirm({ title: 'Leave this page?', message: 'You’ll lose access until you’re invited again.', confirmLabel: 'Leave' }))) return
    await supabase.from('page_members').delete().eq('id', mine.id)
    try {
      localStorage.removeItem('lib_page')
    } catch {
      /* ignore */
    }
    reload()
  }

  const inviteText = encodeURIComponent(`I’ve added you to my ${APP_NAME} page /${page.username}. Sign in (or sign up) with this email to get access: ${window.location.origin}/signin`)

  return (
    <div className="space-y-4">
      <PageHeading title="Team." italic="Work together.">
        Give your manager, agency or editor access to <b>/{page.username}</b> without sharing your password.
      </PageHeading>

      {!isOwner && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">You’re a <b>{role}</b> on this page.</p>
          <Button variant="dangerSoft" size="sm" onClick={leave}><LogOut className="size-4" /> Leave page</Button>
        </Card>
      )}

      {canManage && (
        <Card className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Invite someone</h2>
            {features && <Badge tone={full ? 'red' : 'neutral'}>{members?.length ?? 0} / {max} seats</Badge>}
          </div>
          {features && max === 0 ? (
            <div className="mt-4">
              <Alert tone="info">
                Team access is part of Pro. {isOwner ? <Link to="/dashboard/billing" className="font-semibold underline">Upgrade</Link> : 'Ask the page owner to upgrade.'}
              </Alert>
            </div>
          ) : (
            <form onSubmit={invite} className="mt-5 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
              <Input label="Email" type="email" required placeholder="manager@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={full} />
              <Select label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value)} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} />
              <Button type="submit" className="h-12" loading={busy} disabled={full || !email}>Invite</Button>
            </form>
          )}
          <ul className="mt-5 grid gap-2 text-sm text-ink-600 sm:grid-cols-3">
            {ROLES.map((r) => (
              <li key={r.value} className="rounded-2xl bg-cream p-3"><b className="text-ink">{r.label}</b> — {r.desc}</li>
            ))}
          </ul>
        </Card>
      )}

      {members === null ? (
        <div className="grid h-40 place-items-center"><Spinner /></div>
      ) : members.length === 0 ? (
        <Empty icon={UsersRound} title="No team members yet">Only you can edit this page.</Empty>
      ) : (
        <>
        <ViewToggle value={view} onChange={setView} />
        {view === 'table' ? (
          <DataTable
            rows={members}
            minWidth={680}
            columns={[
              { key: 'email', label: 'Email', value: (m) => m.email, className: 'truncate', render: (m) => `${m.email}${m.user_id === user.id ? ' (you)' : ''}` },
              { key: 'status', label: 'Status', value: (m) => (m.accepted_at ? 'Active' : 'Pending'), render: (m) => (m.accepted_at ? <Badge tone="green">Active</Badge> : <Badge>Pending</Badge>) },
              { key: 'role', label: 'Role', value: (m) => m.role, render: (m) => (canManage ? (
                <select className="field h-9 w-28 text-sm" value={m.role} onChange={(e) => changeRole(m, e.target.value)} aria-label="Role">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              ) : <Badge>{m.role}</Badge>) },
              { key: 'accepted_at', label: 'Joined', value: (m) => m.accepted_at, className: 'whitespace-nowrap text-ink-500', render: (m) => (m.accepted_at ? new Date(m.accepted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—') },
              { key: 'actions', label: '', align: 'right', render: (m) => canManage && <button type="button" onClick={() => remove(m)} className="ml-auto grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove"><Trash2 className="size-4" /></button> },
            ]}
          />
        ) : (
        <Card className="divide-y divide-ink/5">
          {members.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lilac-100 font-bold">{m.email[0].toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.email}{m.user_id === user.id && ' (you)'}</p>
                <p className="text-xs text-ink-500">
                  {m.accepted_at ? `Joined ${new Date(m.accepted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Invite pending — they need to sign in with this email'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {m.accepted_at ? <Badge tone="green">Active</Badge> : <Badge>Pending</Badge>}
                {canManage ? (
                  <>
                    <select className="field h-9 w-28 text-sm" value={m.role} onChange={(e) => changeRole(m, e.target.value)} aria-label="Role">
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {!m.accepted_at && (
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Join my ${APP_NAME} page`)}&body=${inviteText}`} className="grid size-9 place-items-center rounded-full bg-cream" aria-label="Email invite">
                        <Mail className="size-4" />
                      </a>
                    )}
                    <button type="button" onClick={() => remove(m)} className="grid size-9 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : (
                  <Badge>{m.role}</Badge>
                )}
              </div>
            </div>
          ))}
        </Card>
        )}
        </>
      )}
    </div>
  )
}
