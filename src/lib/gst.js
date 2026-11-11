// GST helpers shared by the invoice editor, the print view and analytics.
// Tax maths mirrors public.compute_invoice() so the preview matches what is saved.

/** States & UTs with their GST state codes and ISO 3166-2:IN codes (used for geo analytics) */
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir', iso: ['JK'] },
  { code: '02', name: 'Himachal Pradesh', iso: ['HP'] },
  { code: '03', name: 'Punjab', iso: ['PB'] },
  { code: '04', name: 'Chandigarh', iso: ['CH'] },
  { code: '05', name: 'Uttarakhand', iso: ['UT', 'UK'] },
  { code: '06', name: 'Haryana', iso: ['HR'] },
  { code: '07', name: 'Delhi', iso: ['DL'] },
  { code: '08', name: 'Rajasthan', iso: ['RJ'] },
  { code: '09', name: 'Uttar Pradesh', iso: ['UP'] },
  { code: '10', name: 'Bihar', iso: ['BR'] },
  { code: '11', name: 'Sikkim', iso: ['SK'] },
  { code: '12', name: 'Arunachal Pradesh', iso: ['AR'] },
  { code: '13', name: 'Nagaland', iso: ['NL'] },
  { code: '14', name: 'Manipur', iso: ['MN'] },
  { code: '15', name: 'Mizoram', iso: ['MZ'] },
  { code: '16', name: 'Tripura', iso: ['TR'] },
  { code: '17', name: 'Meghalaya', iso: ['ML'] },
  { code: '18', name: 'Assam', iso: ['AS'] },
  { code: '19', name: 'West Bengal', iso: ['WB'] },
  { code: '20', name: 'Jharkhand', iso: ['JH'] },
  { code: '21', name: 'Odisha', iso: ['OR', 'OD'] },
  { code: '22', name: 'Chhattisgarh', iso: ['CT', 'CG'] },
  { code: '23', name: 'Madhya Pradesh', iso: ['MP'] },
  { code: '24', name: 'Gujarat', iso: ['GJ'] },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu', iso: ['DH', 'DN', 'DD'] },
  { code: '27', name: 'Maharashtra', iso: ['MH'] },
  { code: '29', name: 'Karnataka', iso: ['KA'] },
  { code: '30', name: 'Goa', iso: ['GA'] },
  { code: '31', name: 'Lakshadweep', iso: ['LD'] },
  { code: '32', name: 'Kerala', iso: ['KL'] },
  { code: '33', name: 'Tamil Nadu', iso: ['TN'] },
  { code: '34', name: 'Puducherry', iso: ['PY'] },
  { code: '35', name: 'Andaman & Nicobar Islands', iso: ['AN'] },
  { code: '36', name: 'Telangana', iso: ['TG', 'TS'] },
  { code: '37', name: 'Andhra Pradesh', iso: ['AP'] },
  { code: '38', name: 'Ladakh', iso: ['LA'] },
  { code: '97', name: 'Other Territory', iso: [] },
]

export const STATE_OPTIONS = [
  { value: '', label: 'Select state' },
  ...INDIAN_STATES.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` })),
]

export function stateName(code) {
  return INDIAN_STATES.find((s) => s.code === code)?.name || ''
}

/** Region label for geo analytics: "MH" → "Maharashtra"; foreign "US-CA" stays as is */
export function regionName(iso) {
  return INDIAN_STATES.find((s) => s.iso.includes(String(iso).toUpperCase()))?.name || iso
}

export const DEFAULT_SAC = '998361' // Advertising services (influencer marketing)

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

export function gstinError(v) {
  if (!v) return null
  if (!GSTIN_RE.test(v)) return 'GSTIN should look like 27ABCDE1234F1Z5'
  if (!stateName(v.slice(0, 2))) return 'The first two digits must be a valid state code'
  return null
}

const round2 = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100

export function lineAmount(it) {
  return round2((Number(it.qty) || 0) * (Number(it.rate) || 0))
}

/** Mirror of compute_invoice(): seller = billing snapshot, brandStateCode = buyer's 2-digit code */
export function computeTax(items, seller = {}, brandStateCode) {
  const subtotal = round2((items || []).reduce((s, it) => s + lineAmount(it), 0))
  const r = seller?.gst_rate
  const rate = r === '' || r == null || Number.isNaN(Number(r)) ? 18 : Number(r)
  const gstin = seller?.gstin || ''
  const mode = !gstin ? 'none' : brandStateCode && brandStateCode === gstin.slice(0, 2) ? 'intra' : 'inter'
  const cgst = mode === 'intra' ? round2((subtotal * rate) / 200) : 0
  const sgst = cgst
  const igst = mode === 'inter' ? round2((subtotal * rate) / 100) : 0
  return { mode, rate, subtotal, cgst, sgst, igst, total: round2(subtotal + cgst + sgst + igst) }
}

export function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Today's date in IST as YYYY-MM-DD */
export function istToday() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** First day (YYYY-MM-DD) of the Indian financial year containing `day` */
export function fyStart(day = istToday()) {
  const [y, m] = day.split('-').map(Number)
  return `${m >= 4 ? y : y - 1}-04-01`
}

export function formatDate(d) {
  if (!d) return '—'
  return new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------- Amount in words (Indian numbering) ----------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`
}

function threeDigits(n) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ')
}

function integerWords(n) {
  if (n === 0) return 'Zero'
  const parts = []
  const crore = Math.floor(n / 1e7)
  n %= 1e7
  const lakh = Math.floor(n / 1e5)
  n %= 1e5
  const thousand = Math.floor(n / 1e3)
  n %= 1e3
  if (crore) parts.push(`${integerWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (n) parts.push(threeDigits(n))
  return parts.join(' ')
}

/** 118000.5 → "Rupees One Lakh Eighteen Thousand and Fifty Paise Only" */
export function amountInWords(amount) {
  const paiseTotal = Math.round((Number(amount) || 0) * 100)
  const rupees = Math.floor(paiseTotal / 100)
  const paise = paiseTotal % 100
  return `Rupees ${integerWords(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`
}

/** sent + due date passed (IST) */
export function isOverdue(inv) {
  return inv.status === 'sent' && inv.due_date && inv.due_date < istToday()
}

/** Plain-text payment instructions from a billing / seller object */
export function paymentLines(b = {}) {
  const lines = []
  if (b.upi_id) lines.push(`UPI: ${b.upi_id}`)
  if (b.account_number) {
    lines.push(
      [b.account_name && `A/c name: ${b.account_name}`, `A/c no: ${b.account_number}`, b.ifsc && `IFSC: ${b.ifsc}`, b.bank_name && `Bank: ${b.bank_name}`]
        .filter(Boolean)
        .join(', '),
    )
  }
  return lines
}
