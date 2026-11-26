import { amountInWords, formatDate, formatMoney, stateName } from '../lib/gst'

function Party({ title, name, lines }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">{title}</p>
      <p className="mt-1 text-[15px] font-bold break-words">{name || '—'}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="text-[12.5px] leading-snug whitespace-pre-line break-words text-ink-700">{l}</p>
      ))}
    </div>
  )
}

/**
 * One A4 page. With a GSTIN it is a Tax Invoice that splits the price the buyer paid into taxable value, CGST and SGST.
 * Without a GSTIN it is a plain Invoice with no GST lines. `data` comes from get_order_invoice / creator_order_invoice.
 */
export default function OrderInvoice({ data }) {
  const inv = data.invoice
  const s = inv.seller || {}
  const gst = inv.mode !== 'none'
  const rate = Number(inv.rate)
  const sellerState = s.state_code || s.gstin?.slice(0, 2)
  const stateLine = sellerState && `${s.state || stateName(sellerState)} (${sellerState})`
  const refunded = data.status === 'refunded'

  return (
    <article className="invoice-sheet relative mx-auto w-full max-w-[210mm] bg-white p-6 text-ink shadow-soft sm:p-10 print:max-w-none print:p-0 print:shadow-none">
      <style>{`@media print { @page { size: A4; margin: 12mm; } .invoice-sheet { font-size: 12px; break-inside: avoid; } .invoice-sheet tr { break-inside: avoid; } }`}</style>

      {refunded && <p className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-12 font-display text-7xl font-bold tracking-widest text-red-600/15 uppercase">Refunded</p>}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{gst ? 'Tax Invoice' : 'Invoice'}</h1>
          {!gst && <p className="mt-1 text-xs text-ink-500">Issued by a seller not registered under GST. No GST is charged.</p>}
          {refunded && <p className="mt-1 text-sm font-bold text-red-600 uppercase">Refunded</p>}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[12.5px]">
          <dt className="text-ink-500">Invoice no.</dt>
          <dd className="text-right font-semibold">{inv.no}</dd>
          <dt className="text-ink-500">Date</dt>
          <dd className="text-right font-semibold">{formatDate(inv.date)}</dd>
          <dt className="text-ink-500">Order</dt>
          <dd className="text-right font-semibold">{data.order_ref}</dd>
          {gst && stateLine && (
            <>
              <dt className="text-ink-500">Place of supply</dt>
              <dd className="text-right font-semibold">{stateLine}</dd>
            </>
          )}
        </dl>
      </header>

      <section className="grid gap-6 py-5 sm:grid-cols-2 print:grid-cols-2">
        <Party
          title="Sold by"
          name={s.name}
          lines={[s.address, stateLine && `State: ${stateLine}`, s.gstin && `GSTIN: ${s.gstin}`, s.pan && `PAN: ${s.pan}`, [s.email, s.phone].filter(Boolean).join(' · ')]}
        />
        <Party title="Billed to" name={data.buyer?.name || data.buyer?.email} lines={[data.buyer?.name ? data.buyer?.email : null]} />
      </section>

      <table className="w-full border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="border-y border-ink/30 bg-cream print:bg-transparent">
            <th className="py-2 pr-2 pl-1 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Description</th>
            {gst && <th className="py-2 pr-2 font-semibold">SAC</th>}
            <th className="py-2 pr-2 text-right font-semibold">Qty</th>
            <th className="py-2 pr-1 text-right font-semibold">{gst ? 'Taxable value' : 'Amount'}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-ink/10 align-top">
            <td className="py-2 pr-2 pl-1">1</td>
            <td className="py-2 pr-2 break-words">{data.item}{data.coupon ? <span className="block text-xs text-ink-500">Coupon {data.coupon} applied</span> : null}</td>
            {gst && <td className="py-2 pr-2">{inv.sac}</td>}
            <td className="py-2 pr-2 text-right tabular-nums">1</td>
            <td className="py-2 pr-1 text-right tabular-nums">{formatMoney(inv.taxable)}</td>
          </tr>
        </tbody>
      </table>

      <section className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between print:flex-row print:justify-between">
        <div className="text-[12.5px] sm:max-w-[55%] print:max-w-[55%]">
          <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">Amount in words</p>
          <p className="mt-1 font-semibold">{amountInWords(inv.total)}</p>
          {gst && <p className="mt-2 text-ink-500">Price paid includes GST. Tax payable on reverse charge: No</p>}
        </div>
        <table className="w-full text-[12.5px] sm:w-72 print:w-72">
          <tbody>
            {gst && (
              <>
                <tr>
                  <td className="py-1 text-ink-600">Taxable value</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(inv.taxable)}</td>
                </tr>
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
            <tr className={`${gst ? 'border-t-2 border-ink' : 'border-t border-ink/30'} text-[15px] font-bold`}>
              <td className="pt-2">Total paid</td>
              <td className="pt-2 text-right tabular-nums">{formatMoney(inv.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-6 grid gap-2 border-t border-ink/10 pt-4 text-[12.5px] sm:grid-cols-2 print:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">Payment</p>
          <p className="mt-1">Paid online{data.paid_at ? ` on ${formatDate(data.paid_at)}` : ''}</p>
          {data.payment_ref && <p className="text-ink-600">Payment ID: {data.payment_ref}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-ink-500 uppercase">Need help?</p>
          <p className="mt-1">Refunds and questions: support@joinlyy.com</p>
        </div>
      </section>

      <footer className="mt-8 flex items-end justify-between gap-4 text-[11px] text-ink-500">
        <p>This is a computer-generated invoice and does not need a signature. Payment collected through Joinlyy.</p>
        <div className="text-right">
          <p className="font-semibold text-ink">For {s.name || '—'}</p>
        </div>
      </footer>
    </article>
  )
}
