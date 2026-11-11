// Social profiles a creator can list on their page (pages.socials = { key: handleOrUrl })
export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', prefix: 'https://instagram.com/', placeholder: 'username' },
  { key: 'youtube', label: 'YouTube', prefix: 'https://youtube.com/@', placeholder: 'channel' },
  { key: 'facebook', label: 'Facebook', prefix: 'https://facebook.com/', placeholder: 'page' },
  { key: 'x', label: 'X (Twitter)', prefix: 'https://x.com/', placeholder: 'username' },
  { key: 'github', label: 'GitHub', prefix: 'https://github.com/', placeholder: 'username' },
  { key: 'leetcode', label: 'LeetCode', prefix: 'https://leetcode.com/u/', placeholder: 'username' },
  { key: 'whatsapp', label: 'WhatsApp', prefix: 'https://wa.me/', placeholder: 'number or community link' },
  { key: 'linkedin', label: 'LinkedIn', prefix: 'https://linkedin.com/in/', placeholder: 'profile' },
  { key: 'telegram', label: 'Telegram', prefix: 'https://t.me/', placeholder: 'channel' },
  { key: 'snapchat', label: 'Snapchat', prefix: 'https://snapchat.com/add/', placeholder: 'username' },
  { key: 'moj', label: 'Moj', prefix: 'https://mojapp.in/@', placeholder: 'username' },
  { key: 'josh', label: 'Josh', prefix: 'https://share.myjosh.in/profile/', placeholder: 'profile id' },
  { key: 'sharechat', label: 'ShareChat', prefix: 'https://sharechat.com/profile/', placeholder: 'username' },
  { key: 'email', label: 'Email', prefix: 'mailto:', placeholder: 'you@example.com' },
]

/** How many platforms show before “Show all platforms” */
export const MAIN_SOCIALS = 7

/** Accept either a full URL or a bare handle */
export function socialHref(key, value) {
  const v = (value || '').trim()
  if (!v) return null
  if (/^(https?:|mailto:)/i.test(v)) return v
  // A link pasted without https://, such as chat.whatsapp.com/abc
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(v)) return `https://${v}`
  const def = SOCIALS.find((s) => s.key === key)
  if (!def) return null
  if (key === 'whatsapp') return def.prefix + v.replace(/[^\d]/g, '')
  return def.prefix + v.replace(/^@/, '')
}
