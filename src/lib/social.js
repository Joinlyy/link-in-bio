import { invokeFunction } from './supabase'

// LinkedIn and YouTube connections. Instagram has its own flow in ./instagram.js.
const RETURN_KEY = 'lib_social_return'

export const SOCIAL = {
  linkedin: { name: 'LinkedIn', note: 'Post text, photos, carousels and videos to your profile. LinkedIn asks you to reconnect every 60 days.' },
  youtube: { name: 'YouTube', note: 'Upload videos and Shorts to your channel.' },
  facebook: { name: 'Facebook', note: 'Post text, photos and videos to the Facebook Pages you manage. You choose which Pages to share.' },
}

/** What is available and what this creator has connected */
export function socialStatus() {
  return invokeFunction('social', { action: 'status' })
}

/** Send the creator to LinkedIn or Google to allow posting. Comes back to /<platform>/callback. */
export async function startSocialConnect(platform, returnTo = '/dashboard/settings') {
  try {
    localStorage.setItem(RETURN_KEY, returnTo)
  } catch {
    /* the callback falls back to Settings */
  }
  const { url } = await invokeFunction('social', { action: 'authorize', platform, redirect_uri: `${window.location.origin}/${platform}/callback` })
  window.location.assign(url)
}

export function finishSocialConnect(platform, code, state) {
  return invokeFunction('social', { action: 'exchange', platform, code, state })
}

export function disconnectSocial(platform, accountId) {
  return invokeFunction('social', { action: 'disconnect', platform, ...(accountId ? { account_id: accountId } : {}) })
}

export function socialReturnTo() {
  try {
    const v = localStorage.getItem(RETURN_KEY)
    localStorage.removeItem(RETURN_KEY)
    return v && v.startsWith('/') ? v : '/dashboard/settings'
  } catch {
    return '/dashboard/settings'
  }
}
