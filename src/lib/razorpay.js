// Razorpay Checkout for plan subscriptions. The browser only opens Checkout and reports back; the plan is switched on by the
// server from Razorpay's own records (see supabase/functions/razorpay).
import { invokeFunction } from './supabase'

export const GST_RATE = 0.18
const round2 = (n) => Math.round(n * 100) / 100

/** Price plus 18% GST, the way it is charged */
export function withGst(base) {
  const gst = round2(base * GST_RATE)
  return { base: round2(base), gst, total: round2(base + gst) }
}
export const money2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

let scriptPromise
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = resolve
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load the payment window. Check your connection and try again.'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export const razorpayConfig = () => invokeFunction('razorpay', { action: 'config' }).catch(() => ({ enabled: false }))
export const checkPayment = () => invokeFunction('razorpay', { action: 'check' })
export const cancelAutoRenew = () => invokeFunction('razorpay', { action: 'cancel' })

/**
 * Opens Razorpay Checkout for a plan. Resolves with { dismissed } if the window was closed, or the result of the
 * server-side check after a payment: { status, activated, ends }. A failed attempt keeps the window open so the buyer can retry.
 */
export async function payForPlan({ plan, period, onFailed }) {
  const order = await invokeFunction('razorpay', { action: 'create_subscription', plan, period })
  await loadCheckout()
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: order.key_id,
      subscription_id: order.subscription_id,
      name: order.name,
      description: order.description,
      prefill: { email: order.email },
      theme: { color: '#15161A' },
      handler: async (resp) => {
        try {
          resolve(await invokeFunction('razorpay', {
            action: 'verify',
            subscription_id: resp.razorpay_subscription_id,
            payment_id: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          }))
        } catch (e) {
          reject(e)
        }
      },
      modal: { ondismiss: () => resolve({ dismissed: true }) },
    })
    rz.on('payment.failed', (r) => onFailed?.(r?.error?.description || 'The payment failed. You can try again.'))
    rz.open()
  })
}
