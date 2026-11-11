import { invokeFunction, supabase } from './supabase'
import { uploadImage } from './storage'

/** Start Instagram Business Login. `returnTo` is where we land after the callback. */
export async function startInstagramConnect({ returnTo = '/dashboard/settings', importProfile = false } = {}) {
  sessionStorage.setItem('lib_ig_return', returnTo)
  sessionStorage.setItem('lib_ig_import', importProfile ? '1' : '')
  const { url } = await invokeFunction('instagram', { action: 'authorize' })
  window.location.assign(url)
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
