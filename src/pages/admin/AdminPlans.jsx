import { useCallback, useEffect, useState } from 'react'
import { Crown, Plus } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Badge, Button, Card, Empty, Input, Modal, Spinner, Toggle, useToast, askConfirm } from '../../components/ui'
import { PageHeading } from '../dashboard/DashboardLayout'

const LIMIT_FIELDS = [
  ['max_pages', 'Bio pages'],
  ['max_site_pages', 'Sub-pages / page'],
  ['max_team', 'Team / page'],
  ['max_products', 'Products / page'],
]
const BOOL_FIELDS = [
  ['remove_branding', 'Remove branding'],
  ['custom_domain', 'Custom domain'],
]

const BLANK = {
  id: '', name: '', description: '', price_monthly_inr: 0, price_yearly_inr: 0, is_active: true, position: 0,
  features: { max_pages: 1, max_site_pages: 3, max_team: 0, max_products: 10, remove_branding: false, custom_domain: false },
}

function PlanEditor({ plan, isNew, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(plan)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setFeature = (k, v) => setForm((f) => ({ ...f, features: { ...f.features, [k]: v } }))
  const int = (v) => Math.max(0, parseInt(v, 10) || 0)

  async function save(e) {
    e.preventDefault()
    if (!/^[a-z0-9_]{2,20}$/.test(form.id)) return toast('ID: 2–20 lowercase letters, numbers or _', 'error')
    setBusy(true)
    const row = {
      name: form.name.trim(), description: form.description.trim(),
      price_monthly_inr: int(form.price_monthly_inr), price_yearly_inr: int(form.price_yearly_inr),
      is_active: form.id === 'free' ? true : form.is_active, position: int(form.position), features: form.features,
    }
    const { error } = isNew
      ? await supabase.from('plans').insert({ id: form.id, ...row })
      : await supabase.from('plans').update(row).eq('id', form.id)
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(isNew ? 'Plan created' : 'Plan saved')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'New plan' : `Edit ${plan.name}`} wide>
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Plan ID" hint={isNew ? 'Permanent — lowercase, e.g. creator_plus' : 'IDs can’t be changed'} value={form.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} required maxLength={20} />
          <Input label="Name" value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={40} />
          <Input className="sm:col-span-2" label="Description" value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={120} />
          <Input label="Monthly price (₹)" type="number" min={0} value={form.price_monthly_inr} onChange={(e) => set({ price_monthly_inr: e.target.value })} />
          <Input label="Yearly price (₹)" type="number" min={0} value={form.price_yearly_inr} onChange={(e) => set({ price_yearly_inr: e.target.value })} />
        </div>
        <div>
          <p className="eyebrow text-ink-500">Limits</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {LIMIT_FIELDS.map(([k, label]) => (
              <Input key={k} label={label} type="number" min={0} value={form.features?.[k] ?? 0} onChange={(e) => setFeature(k, int(e.target.value))} />
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl bg-cream p-4">
          {BOOL_FIELDS.map(([k, label]) => (
            <Toggle key={k} label={label} checked={!!form.features?.[k]} onChange={(v) => setFeature(k, v)} />
          ))}
          <Toggle label="Active" description={form.id === 'free' ? 'The Free plan is always active' : 'Inactive plans are hidden from the billing page'} checked={form.id === 'free' ? true : form.is_active} disabled={form.id === 'free'} onChange={(v) => set({ is_active: v })} />
        </div>
        <Input label="Position (sort order)" type="number" min={0} value={form.position} onChange={(e) => set({ position: e.target.value })} className="max-w-40" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{isNew ? 'Create plan' : 'Save changes'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminPlans() {
  const toast = useToast()
  const [plans, setPlans] = useState(null)
  const [counts, setCounts] = useState({})
  const [editing, setEditing] = useState(null) // { plan, isNew }

  const load = useCallback(async () => {
    const { data } = await supabase.from('plans').select('*').order('position').order('id')
    setPlans(data || [])
    const entries = await Promise.all(
      (data || []).map(async (p) => {
        const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('plan', p.id)
        return [p.id, count || 0]
      }),
    )
    setCounts(Object.fromEntries(entries))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function remove(p) {
    if (p.id === 'free') return
    if (!(await askConfirm({ title: `Delete the ${p.name} plan?`, message: 'Creators on it must be moved first.', confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('plans').delete().eq('id', p.id)
    if (error) return toast(/foreign key/i.test(error.message) ? 'Creators or subscriptions still use this plan — deactivate it instead.' : errorMessage(error), 'error')
    toast('Plan deleted')
    load()
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Plans & pricing."
        italic="What creators pay."
        actions={<Button onClick={() => setEditing({ plan: { ...BLANK, position: (plans?.length || 0) }, isNew: true })}><Plus className="size-4" /> New plan</Button>}
      >
        Changes apply instantly to limits and the billing page. Payments are in test mode.
      </PageHeading>
      {plans === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : plans.length === 0 ? (
        <Empty icon={Crown} title="No plans" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="flex flex-col p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold">{p.name}</h2>
                <Badge>{p.id}</Badge>
                {p.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
              </div>
              <p className="mt-1 text-sm text-ink-500">{p.description || '—'}</p>
              <p className="mt-4 font-display text-3xl font-bold">{formatInr(p.price_monthly_inr)}<span className="text-sm font-medium text-ink-500"> / mo · {formatInr(p.price_yearly_inr)} / yr</span></p>
              <dl className="mt-4 grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {LIMIT_FIELDS.map(([k, label]) => (
                  <div key={k} className="flex justify-between gap-2"><dt className="text-ink-500">{label}</dt><dd className="font-semibold">{p.features?.[k] ?? '—'}</dd></div>
                ))}
                {BOOL_FIELDS.map(([k, label]) => (
                  <div key={k} className="flex justify-between gap-2"><dt className="text-ink-500">{label}</dt><dd className="font-semibold">{p.features?.[k] ? 'Yes' : 'No'}</dd></div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-ink-400">{counts[p.id] ?? '…'} creator{counts[p.id] === 1 ? '' : 's'} · position {p.position}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ plan: p, isNew: false })}>Edit</Button>
                {p.id !== 'free' && <Button size="sm" variant="dangerSoft" onClick={() => remove(p)}>Delete</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <PlanEditor
          key={editing.plan.id || 'new'}
          plan={editing.plan}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
