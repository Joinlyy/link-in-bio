import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarCheck, ChevronLeft, Receipt } from 'lucide-react'
import { usePage } from '../../../context/PageContext'
import { supabase } from '../../../lib/supabase'
import { formatInr } from '../../../lib/images'
import { calendarUrl, formatIst } from '../../../lib/slots'
import { Badge, Button, Card, Empty, Spinner, Stats } from '../../../components/ui'
import { DataTable } from '../../../components/DataTable'
import { PageHeading } from '../DashboardLayout'
import { ORDER_COLUMNS } from '../Sales'
import RescheduleBooking from '../../../components/RescheduleBooking'

const TONE = { paid: 'green', refunded: 'red', pending: 'lilac', failed: 'neutral' }
const LABEL = { pending: 'waiting for payment', failed: 'payment not received' }
const fmt = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }

/** Everything about one product: its sales history and, for 1:1 sessions and webinars, who is booked and when */
export default function ProductSales() {
  const { id } = useParams()
  const { page } = usePage()
  const [product, setProduct] = useState(undefined)
  const [orders, setOrders] = useState(null)
  const [bookings, setBookings] = useState(null)
  const [moving, setMoving] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: p } = await supabase.from('products').select('id, title, type, price_inr, data, private, sales_count').eq('id', id).eq('page_id', page.id).maybeSingle()
      if (!live) return
      setProduct(p || null)
      if (!p) return
      const [{ data: o }, { data: b }] = await Promise.all([
        supabase.from('orders').select(ORDER_COLUMNS).eq('product_id', id).order('created_at', { ascending: false }).limit(500),
        supabase.from('bookings').select('*').eq('product_id', id).order('starts_at', { ascending: true }).limit(500),
      ])
      if (!live) return
      setOrders(o || [])
      setBookings(b || [])
    })()
    return () => { live = false }
  }, [id, page.id, tick])

  const stats = useMemo(() => {
    const paid = (orders || []).filter((o) => o.status === 'paid')
    return { count: paid.length, revenue: paid.reduce((s, o) => s + Number(o.amount_inr), 0), refunded: (orders || []).filter((o) => o.status === 'refunded').length }
  }, [orders])

  if (product === undefined || !orders || !bookings) return <div className="grid h-60 place-items-center"><Spinner /></div>
  if (product === null) return <Empty icon={Receipt} title="Product not found" action={<Button to="/dashboard/products">Back to products</Button>} />

  const meeting = product.private?.meeting_url
  const isSession = product.type === 'session'
  const isWebinar = product.type === 'webinar'
  const now = Date.now() - 2 * 3600_000
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && new Date(b.starts_at).getTime() >= now)
  const past = bookings.filter((b) => !upcoming.includes(b)).reverse()
  const webinarStart = isWebinar && product.data?.starts_at
  const attendees = orders.filter((o) => o.status === 'paid')

  const bookingRow = (b) => (
    <Card key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="grid w-16 shrink-0 place-items-center rounded-2xl bg-lime py-2 text-center">
        <span className="text-[10px] font-bold uppercase">{formatIst(b.starts_at, { month: 'short' })}</span>
        <span className="font-display text-2xl leading-none font-bold">{formatIst(b.starts_at, { day: 'numeric' })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{formatIst(b.starts_at, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} to {formatIst(b.ends_at, { hour: 'numeric', minute: '2-digit' })} IST</p>
        <p className="truncate text-sm text-ink-500">{b.buyer_name || 'Buyer'} · {b.buyer_email}{b.buyer_phone && ` · ${b.buyer_phone}`}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={b.status === 'confirmed' ? 'green' : b.status === 'cancelled' ? 'red' : 'neutral'}>{b.status}</Badge>
        {b.status === 'confirmed' && (
          <>
            <Button variant="outline" size="sm" href={calendarUrl({ title: `${product.title} with ${b.buyer_name || b.buyer_email}`, start: b.starts_at, end: b.ends_at, details: meeting || '' })} target="_blank" rel="noreferrer">Add to calendar</Button>
            {new Date(b.starts_at).getTime() > Date.now() && <Button variant="soft" size="sm" onClick={() => setMoving(b)}>Reschedule</Button>}
          </>
        )}
      </div>
    </Card>
  )

  return (
    <div className="space-y-5">
      <Link to="/dashboard/sales" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink"><ChevronLeft className="size-4" /> Products and sales</Link>
      <PageHeading title={product.title || 'Product'} italic="Sales and sessions.">
        Every order for this product{isSession ? ', and the time slot each buyer booked' : isWebinar ? ', and who is attending' : ''}.
      </PageHeading>
      <Stats items={[['Sold', stats.count, 'bg-lime'], ['Revenue', formatInr(stats.revenue), 'bg-white'], ['Refunded', stats.refunded, 'bg-lilac-100']]} />

      {isSession && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarCheck className="size-5" /> Upcoming sessions ({upcoming.length})</h2>
          {upcoming.length === 0 ? <Empty icon={CalendarCheck} title="No upcoming sessions">Booked time slots show up here and in your email, with a calendar invite.</Empty> : <div className="grid gap-2.5">{upcoming.map(bookingRow)}</div>}
          {past.length > 0 && (
            <>
              <h3 className="pt-2 text-sm font-bold text-ink-500">Past and cancelled</h3>
              <div className="grid gap-2.5">{past.map(bookingRow)}</div>
            </>
          )}
        </section>
      )}

      {isWebinar && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarCheck className="size-5" /> {webinarStart ? `Live on ${formatIst(webinarStart, fmt)} IST` : 'Webinar date not set'}</h2>
          <p className="text-sm text-ink-500">{attendees.length} {attendees.length === 1 ? 'person has' : 'people have'} registered.</p>
          {webinarStart && <Button variant="outline" size="sm" href={calendarUrl({ title: product.title, start: webinarStart, end: new Date(new Date(webinarStart).getTime() + (product.data?.duration || 60) * 60000).toISOString(), details: meeting || '' })} target="_blank" rel="noreferrer">Add to my calendar</Button>}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Receipt className="size-5" /> Order history ({orders.length})</h2>
        {orders.length === 0 ? <Empty icon={Receipt} title="No orders yet" /> : (
          <Card className="overflow-hidden">
            <DataTable
              bare
              rows={orders}
              minWidth={760}
              columns={[
                { key: 'when', label: 'Date', value: (o) => o.created_at, className: 'whitespace-nowrap text-ink-600', render: (o) => formatIst(o.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
                { key: 'buyer', label: 'Buyer', value: (o) => o.buyer_name || o.buyer_email, render: (o) => <span>{o.buyer_name || o.buyer_email}<span className="block text-xs text-ink-500">{o.buyer_email}{o.buyer_phone && ` · ${o.buyer_phone}`}</span></span> },
                { key: 'slot', label: isSession ? 'Booked slot' : isWebinar ? 'Starts' : '', value: (o) => bookings.find((b) => b.order_id === o.id)?.starts_at || '', render: (o) => {
                  const b = bookings.find((x) => x.order_id === o.id)
                  if (isWebinar) return webinarStart ? formatIst(webinarStart, fmt) : '—'
                  return b ? formatIst(b.starts_at, fmt) : isSession ? 'Not booked yet' : ''
                } },
                { key: 'amount', label: 'Amount', align: 'right', value: (o) => Number(o.amount_inr), className: 'font-semibold', render: (o) => formatInr(o.amount_inr) },
                { key: 'status', label: 'Status', value: (o) => o.status, render: (o) => <Badge tone={TONE[o.status] || 'neutral'}>{LABEL[o.status] || o.status}</Badge> },
              ]}
            />
          </Card>
        )}
      </section>
      <RescheduleBooking booking={moving} product={product} onClose={() => setMoving(null)} onDone={() => setTick((t) => t + 1)} />
    </div>
  )
}
