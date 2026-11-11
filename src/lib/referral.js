// Referral capture: `?ref=CODE` on any marketing page is remembered in localStorage
// and attached to the next sign-up (email: user metadata, Google: claim_referral RPC).
export const REF_KEY = 'lib_ref'

export function captureRef() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref')
    const clean = (code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32)
    if (clean) localStorage.setItem(REF_KEY, clean)
  } catch {
    /* storage blocked */
  }
}

export function storedRef() {
  try {
    return localStorage.getItem(REF_KEY) || null
  } catch {
    return null
  }
}

export function clearRef() {
  try {
    localStorage.removeItem(REF_KEY)
  } catch {
    /* ignore */
  }
}

export function referralLink(code) {
  return `${window.location.origin}/?ref=${code}`
}

export const AMBASSADOR_TIERS = [
  { id: 'bronze', name: 'Bronze', min: 5, color: '#C98A4B' },
  { id: 'silver', name: 'Silver', min: 15, color: '#A8ABB3' },
  { id: 'gold', name: 'Gold', min: 50, color: '#E3B53C' },
]

/** Highest tier reached for a number of published referrals (or null) */
export function ambassadorTier(published) {
  return [...AMBASSADOR_TIERS].reverse().find((t) => published >= t.min) || null
}
