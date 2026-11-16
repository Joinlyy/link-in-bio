import { invokeFunction, supabase } from './supabase'
import { uploadImage } from './storage'

// The connection runs in a new tab, so its settings go in localStorage (sessionStorage is per tab)
const CHANNEL = 'lib-instagram'
const KEYS = { returnTo: 'lib_ig_return', importProfile: 'lib_ig_import', newTab: 'lib_ig_newtab' }

function store(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* private mode: the callback falls back to defaults */
  }
}
function read(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

/** What startInstagramConnect remembered, for the callback page */
export function connectSettings() {
  return {
    returnTo: read(KEYS.returnTo) || '/dashboard/settings',
    importProfile: Boolean(read(KEYS.importProfile)),
    // Set when the connection was opened in its own tab (valid for 30 minutes)
    newTab: Date.now() - Number(read(KEYS.newTab) || 0) < 30 * 60_000,
  }
}
export function clearConnectSettings() {
  Object.values(KEYS).forEach((k) => store(k, ''))
}

/**
 * Start Instagram Business Login in a new tab, keeping this page open. Must be called straight from a click
 * (before any await) so the browser allows the tab. Falls back to this tab if pop-ups are blocked.
 * `returnTo` is where the callback sends people when it can't close its tab.
 */
export async function startInstagramConnect({ returnTo = '/dashboard/settings', importProfile = false } = {}) {
  store(KEYS.returnTo, returnTo)
  store(KEYS.importProfile, importProfile ? '1' : '')
  const tab = window.open('', '_blank')
  if (tab) {
    try {
      tab.document.title = 'Connecting Instagram…'
      tab.document.body.style.cssText = 'font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#15161A;background:#F2F1EC'
      tab.document.body.textContent = 'Opening Instagram…'
    } catch {
      /* cosmetic only */
    }
  }
  store(KEYS.newTab, tab ? String(Date.now()) : '')
  try {
    const { url } = await invokeFunction('instagram', { action: 'authorize' })
    if (tab && !tab.closed) tab.location.href = url
    else window.location.assign(url)
  } catch (err) {
    tab?.close()
    store(KEYS.newTab, '')
    throw err
  }
}

/** Tell other open tabs that Instagram was connected */
export function announceInstagramConnected() {
  try {
    const ch = new BroadcastChannel(CHANNEL)
    ch.postMessage({ type: 'connected' })
    ch.close()
  } catch {
    /* old browsers: the other tab updates on its next load */
  }
}

/** Run `fn` when Instagram gets connected in another tab. Returns an unsubscribe function. */
export function onInstagramConnected(fn) {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(CHANNEL)
  ch.onmessage = (e) => {
    if (e.data?.type === 'connected') fn()
  }
  return () => ch.close()
}

export async function exchangeInstagramCode(code, state) {
  const { account } = await invokeFunction('instagram', { action: 'exchange', code, state })
  return account
}

export async function syncInstagram() {
  const { account } = await invokeFunction('instagram', { action: 'sync' })
  return account
}

export async function disconnectInstagram() {
  await invokeFunction('instagram', { action: 'disconnect' })
}

/**
 * Fill empty page fields from the imported Instagram profile ("starter page").
 * Instagram CDN photo URLs expire, so the avatar is copied to our storage bucket when possible.
 */
export async function applyInstagramToPage(page, account) {
  const patch = {}
  if (!page.display_name && account.name) patch.display_name = account.name.slice(0, 80)
  if (!page.bio && account.biography) patch.bio = account.biography.slice(0, 300)
  if (!page.socials?.instagram && account.username) patch.socials = { ...(page.socials || {}), instagram: account.username }
  if (!page.avatar_url && account.profile_picture_url) {
    try {
      patch.avatar_url = await uploadImage(account.profile_picture_url, 'avatars')
    } catch {
      patch.avatar_url = account.profile_picture_url
    }
  }
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('pages').update(patch).eq('id', page.id)
    if (error) throw error
  }
  return patch
}
