export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'LinkInBio'
/** The site's own domain, once one is set (VITE_PUBLIC_DOMAIN) */
export const CONFIGURED_DOMAIN = import.meta.env.VITE_PUBLIC_DOMAIN || ''
/** The address creators share. Until a domain is set it's the address the app runs on, so it always works */
export const PUBLIC_DOMAIN = CONFIGURED_DOMAIN || (typeof window === 'undefined' ? '' : window.location.host)
/** Instagram import and DM automation need a Meta app. They stay hidden until it's set up */
export const INSTAGRAM_ENABLED = import.meta.env.VITE_INSTAGRAM_ENABLED === 'true'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env')
}

/**
 * Hosts that serve the full app. Any other host is treated as a creator's custom domain.
 * VITE_APP_HOSTS: comma-separated list; *.vercel.app previews always count as app hosts.
 */
const APP_HOSTS = (import.meta.env.VITE_APP_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)
  .concat(['localhost', '127.0.0.1', ...(CONFIGURED_DOMAIN ? [CONFIGURED_DOMAIN, `www.${CONFIGURED_DOMAIN}`] : [])])

export function isCustomDomainHost(host = window.location.hostname) {
  const h = host.toLowerCase()
  return !APP_HOSTS.includes(h) && !h.endsWith('.vercel.app') && !h.endsWith('.localhost')
}

/** Public URL of a creator page on the current origin */
export function pageUrl(username) {
  return `${window.location.origin}/${username}`
}

/** Short display form, e.g. yourbrand.in/priya */
export function pageDisplayUrl(username) {
  return `${PUBLIC_DOMAIN}/${username}`
}

/** localStorage key supabase-js uses for the session */
export const SESSION_STORAGE_KEY = (() => {
  try {
    return `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
  } catch {
    return 'sb-auth-token'
  }
})()

/** Cheap check (no supabase-js import) used by marketing pages for the header CTA */
export function hasStoredSession() {
  try {
    return Boolean(localStorage.getItem(SESSION_STORAGE_KEY))
  } catch {
    return false
  }
}
