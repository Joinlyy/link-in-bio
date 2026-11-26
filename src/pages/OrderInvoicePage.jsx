import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { errorMessage, supabase } from '../lib/supabase'
import { fetchOrderInvoice } from '../lib/publicApi'
import { Button, Spinner } from '../components/ui'
import OrderInvoice from '../components/OrderInvoice'

/**
 * A sale's invoice, as one printable page. Buyers reach it with their order link (/order/<token>/invoice);
 * creators reach it from Sales (/invoices/order/<order id>/print).
 */
export default function OrderInvoicePage({ creator = false }) {
  const { token, id } = useParams()
  const [data, setData] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = creator
      ? supabase.rpc('creator_order_invoice', { p_order_id: id }).then(({ data: d, error: e }) => { if (e) throw e; return d })
      : fetchOrderInvoice(token)
    load.then((d) => alive && setData(d || null)).catch((e) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [creator, id, token])

  const back = creator ? '/dashboard/sales' : `/order/${token}`
  if (error) return <div className="grid min-h-dvh place-items-center p-6 text-center"><p className="font-semibold">{error}</p></div>
  if (data === undefined) return <div className="grid min-h-dvh place-items-center"><Spinner className="size-7" /></div>
  if (data === null) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-semibold">There is no invoice for this order yet.</p>
          <p className="mt-1 text-sm text-ink-500">Invoices are made when a payment goes through.</p>
          <Button to={back} variant="outline" size="sm" className="mt-4"><ArrowLeft className="size-4" /> Back</Button>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-dvh bg-cream py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4">
        <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-semibold"><ArrowLeft className="size-4" /> {creator ? 'Sales' : 'Your order'}</Link>
        <Button size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print / Save PDF</Button>
      </div>
      <OrderInvoice data={data} />
    </div>
  )
}
