import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatInr } from '../../lib/images'
import { Badge, Button, Card, Empty, Spinner, Tabs, useToast, askText } from '../../components/ui'
import { DataTable, useViewMode, ViewToggle } from '../../components/DataTable'
import { PageHeading } from '../dashboard/DashboardLayout'
import { ORDER_COLUMNS } from '../dashboard/Sales'

export default function AdminOrders() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [status, setStatus] = useState('paid')
  const [limit, setLimit] = useState(50)
  const [view, setView] = useViewMode('admin-orders')

  useEffect(() => {
    setRows(null)
    supabase
      .from('orders')
      .select(`${ORDER_COLUMNS}, pages(username)`)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => setRows(data || []))
  }, [status, limit])

  async function refund(o) {
    const reason = await askText({ title: 'Refund this order?', message: `${formatInr(o.amount_inr)} to ${o.buyer_email}`, label: 'Reason (shown on the order)', defaultValue: 'Refunded by admin', confirmLabel: 'Refund', danger: true })
    if (reason === null) return
    // refund_order also cancels bookings, fixes sales counts and closes open disputes
    const { error } = await supabase.rpc('refund_order', { p_order_id: o.id, p_reason: reason.trim() || 'Refunded by admin' })
    if (error) return toast(error.message, 'error')
    setRows((r) => r.filter((x) => x.id !== o.id))
    toast('Refunded (test mode)')
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Orders." italic="Across all creators.">Payments are in test mode until Razorpay/Cashfree is connected.</PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Status" value={status} onChange={setStatus} tabs={[['paid', 'Paid'], ['refunded', 'Refunded'], ['failed', 'Failed']].map(([key, label]) => ({ key, label }))} />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {rows === null ? (
        <div className="grid h-60 place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty icon={Receipt} title={`No ${status} orders`} />
      ) : (
        <Card className="divide-y divide-ink/5">
          {view === 'table' ? (
            <DataTable
              bare
              rows={rows}
              defaultSort={{ key: 'created_at', dir: -1 }}
              minWidth={860}
              columns={[
                { key: 'item', label: 'Item', value: (o) => (o.kind === 'tip' ? 'Tip' : o.product_title), className: 'truncate' },
                { key: 'page', label: 'Page', value: (o) => o.pages?.username, className: 'text-ink-600', render: (o) => `/${o.pages?.username}` },
                { key: 'buyer_email', label: 'Buyer', value: (o) => o.buyer_email, className: 'max-w-56 truncate text-ink-600' },
                { key: 'created_at', label: 'Date', value: (o) => o.created_at, className: 'whitespace-nowrap text-ink-500', render: (o) => new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
                { key: 'amount_inr', label: 'Amount', align: 'right', value: (o) => o.amount_inr, className: 'font-semibold', render: (o) => formatInr(o.amount_inr) },
                { key: 'actions', label: '', align: 'right', render: (o) => status === 'paid' && <Button variant="ghost" size="sm" onClick={() => refund(o)}>Refund</Button> },
              ]}
            />
          ) : rows.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{o.kind === 'tip' ? 'Tip' : o.product_title} <span className="font-normal text-ink-500">· /{o.pages?.username}</span></p>
                <p className="truncate text-sm text-ink-500">{o.buyer_email} · {o.payment_ref}</p>
                {o.status === 'refunded' && o.refund_reason && <p className="truncate text-xs text-ink-400">Refund: {o.refund_reason}</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-ink-400">{new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                {o.payment_provider === 'test' && <Badge>Test</Badge>}
                <span className="w-20 text-right font-display text-lg font-bold">{formatInr(o.amount_inr)}</span>
                {status === 'paid' && <Button variant="ghost" size="sm" onClick={() => refund(o)}>Refund</Button>}
              </div>
            </div>
          ))}
          {rows.length >= limit && (
            <div className="p-4 text-center"><Button variant="soft" size="sm" onClick={() => setLimit((l) => l + 50)}>Load more</Button></div>
          )}
        </Card>
      )}
    </div>
  )
}
