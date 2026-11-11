import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { errorMessage, supabase } from '../../lib/supabase'
import { Button, Spinner } from '../../components/ui'
import { amountInWords, formatDate, formatMoney, lineAmount, stateName } from '../../lib/gst'

function Party({ title, name, lines }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">{title}</p>
      <p className="mt-1 text-[15px] font-bold">{name || '—'}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="text-[12.5px] leading-snug whitespace-pre-line text-ink-700">{l}</p>
      ))}
    </div>
  )
}

export default function InvoicePrint() {
  const { id } = useParams()
  const [inv, setInv] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) setError(errorMessage(err))
        else if (!data) setError('Invoice not found, or you don’t have access to it.')
        else setInv(data)
      })
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (!inv) return
    const prev = document.title
    // Browsers use the title as the default PDF file name
    document.title = `${inv.number.replaceAll('/', '-')} ${inv.brand_name}`
    const t = setTimeout(() => window.print(), 500)
    return () => {
      clearTimeout(t)
      document.title = prev
    }
  }, [inv])

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-semibold">{error}</p>
          <Button to="/dashboard/invoices" variant="outline" size="sm" className="mt-4"><ArrowLeft className="size-4" /> Back to invoices</Button>
        </div>
      </div>
    )
  }
  if (!inv) {
    return (
      <div className="grid min-h-dvh place-items-center"><Spinner className="size-7" /></div>
    )
  }

  const s = inv.seller || {}
  const gst = inv.tax_mode !== 'none'
  const rate = Number(inv.gst_rate)
  const placeOfSupply = inv.brand_state_code ? `${stateName(inv.brand_state_code) || 'State'} (${inv.brand_state_code})` : '—'
  const sellerState = s.state_code || s.gstin?.slice(0, 2)
  const hasBank = s.account_number || s.upi_id

  return (
    <div className="min-h-dvh bg-cream py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4">
        <Button to="/dashboard/invoices" variant="ghost" size="sm"><ArrowLeft className="size-4" /> Invoices</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print / Save PDF</Button>
      </div>

      <article className="invoice-sheet mx-auto w-full max-w-[210mm] bg-white p-6 text-ink shadow-soft sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <style>{`@media print { @page { size: A4; margin: 12mm; } .invoice-sheet { font-size: 12px; } .invoice-sheet tr { break-inside: avoid; } }`}</style>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{gst ? 'Tax Invoice' : 'Invoice'}</h1>
            {inv.status === 'cancelled' && <p className="mt-1 text-sm font-bold text-red-600 uppercase">Cancelled</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[12.5px]">
            <dt className="text-ink-500">Invoice no.</dt>
            <dd className="text-right font-semibold">{inv.number}</dd>
            <dt className="text-ink-500">Date</dt>
            <dd className="text-right font-semibold">{formatDate(inv.issue_date)}</dd>
            {inv.due_date && (
              <>
                <dt className="text-ink-500">Due date</dt>
                <dd className="text-right font-semibold">{formatDate(inv.due_date)}</dd>
              </>
            )}
            {gst && (
              <>
                <dt className="text-ink-500">Place of supply</dt>
                <dd className="text-right font-semibold">{placeOfSupply}</dd>
              </>
            )}
          </dl>
        </header>

        <section className="grid gap-6 py-5 sm:grid-cols-2 print:grid-cols-2">
          <Party
            title="From"
            name={s.legal_name}
            lines={[
              s.address,
              sellerState && `State: ${s.state || stateName(sellerState)} (${sellerState})`,
              s.gstin && `GSTIN: ${s.gstin}`,
              s.pan && `PAN: ${s.pan}`,
              [s.email, s.phone].filter(Boolean).join(' · '),
            ]}
          />
          <Party
            title="Bill to"
            name={inv.brand_name}
            lines={[
              inv.brand_address,
              inv.brand_state_code && `State: ${stateName(inv.brand_state_code)} (${inv.brand_state_code})`,
              inv.brand_gstin && `GSTIN: ${inv.brand_gstin}`,
              inv.brand_email,
            ]}
          />
        </section>

        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-y border-ink/30 bg-cream print:bg-transparent">
              <th className="py-2 pr-2 pl-1 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Description</th>
              <th className="py-2 pr-2 font-semibold">SAC</th>
              <th className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">Rate</th>
              <th className="py-2 pr-1 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((it, i) => (
              <tr key={i} className="border-b border-ink/10 align-top">
                <td className="py-2 pr-2 pl-1">{i + 1}</td>
                <td className="py-2 pr-2 break-words">{it.description}</td>
                <td className="py-2 pr-2">{it.sac || '—'}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{Number(it.qty).toLocaleString('en-IN')}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatMoney(it.rate)}</td>
                <td className="py-2 pr-1 text-right tabular-nums">{formatMoney(lineAmount(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between print:flex-row print:justify-between">
          <div className="text-[12.5px] sm:max-w-[55%] print:max-w-[55%]">
            <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">Amount in words</p>
            <p className="mt-1 font-semibold">{amountInWords(inv.total)}</p>
            {gst && <p className="mt-2 text-ink-500">Tax payable on reverse charge: No</p>}
          </div>
          <table className="w-full text-[12.5px] sm:w-72 print:w-72">
            <tbody>
              <tr>
                <td className="py-1 text-ink-600">Taxable value</td>
                <td className="py-1 text-right tabular-nums">{formatMoney(inv.subtotal)}</td>
              </tr>
              {inv.tax_mode === 'intra' && (
                <>
                  <tr>
                    <td className="py-1 text-ink-600">CGST @ {rate / 2}%</td>
                    <td className="py-1 text-right tabular-nums">{formatMoney(inv.cgst)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-ink-600">SGST @ {rate / 2}%</td>
                    <td className="py-1 text-right tabular-nums">{formatMoney(inv.sgst)}</td>
                  </tr>
                </>
              )}
              {inv.tax_mode === 'inter' && (
                <tr>
                  <td className="py-1 text-ink-600">IGST @ {rate}%</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(inv.igst)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-ink text-[15px] font-bold">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right tabular-nums">{formatMoney(inv.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {(hasBank || inv.notes) && (
          <section className="mt-6 grid gap-6 border-t border-ink/10 pt-4 text-[12.5px] sm:grid-cols-2 print:grid-cols-2">
            {hasBank && (
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">Payment details</p>
                <div className="mt-1 space-y-0.5">
                  {s.upi_id && <p>UPI: <b>{s.upi_id}</b></p>}
                  {s.account_name && <p>Account name: {s.account_name}</p>}
                  {s.account_number && <p>Account no.: <b>{s.account_number}</b></p>}
                  {s.ifsc && <p>IFSC: {s.ifsc}</p>}
                  {s.bank_name && <p>Bank: {s.bank_name}</p>}
                </div>
              </div>
            )}
            {inv.notes && (
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">Notes</p>
                <p className="mt-1 whitespace-pre-line">{inv.notes}</p>
              </div>
            )}
          </section>
        )}

        <footer className="mt-10 flex items-end justify-between gap-4 text-[11px] text-ink-500">
          <p>This is a computer-generated invoice.</p>
          <div className="text-right">
            <p className="font-semibold text-ink">For {s.legal_name || '—'}</p>
            <p className="mt-8 border-t border-ink/30 pt-1">Authorised signatory</p>
          </div>
        </footer>
      </article>
    </div>
  )
}
