/** Display names for the plan IDs (IDs stay as they are in the database) */
export const PLAN_NAME = { free: 'Starter', pro: 'Creator', business: 'Pro' }

const UNLIMITED = (v) => v === null || v === undefined || v >= 10000
const fmt = (v) => Number(v).toLocaleString('en-IN')

/** A plan's features in plain words, for the home page pricing and the Plan screen. `on` is false for what it doesn't include */
export function featureList(f) {
  const n = (v, one, many) => (UNLIMITED(v) ? `Unlimited ${many}` : v === 1 ? `1 ${one}` : `${fmt(v ?? 0)} ${many}`)
  const dmLimits = [
    UNLIMITED(f.max_automations) ? 'Unlimited Instagram DM automations' : `${f.max_automations} comment → DM automations`,
    UNLIMITED(f.dm_monthly_limit) ? null : `${fmt(f.dm_monthly_limit)} DMs a month`,
  ].filter(Boolean).join(', ')
  return [
    { on: true, text: n(f.max_pages, 'bio page', 'bio pages') },
    { on: true, text: `${n(f.max_site_pages, 'sub-page', 'sub-pages')} per page` },
    { on: true, text: `${n(f.max_products, 'live product', 'live products')}` },
    { on: true, text: f.commission_pct != null ? `${f.commission_pct}% platform charge on sales, the rest paid to your UPI in 2 working days` : 'No platform charge on sales' },
    { on: f.ig_posts_per_day != null, text: `Auto-post to Instagram: ${f.ig_posts_per_day} post${f.ig_posts_per_day === 1 ? '' : 's'} a day, ${f.ig_reels_per_month} Reels a month` },
    { on: true, text: dmLimits },
    { on: !!f.dm_advanced, text: 'Story & DM keyword automations, follow to unlock, lead capture' },
    { on: !!f.whatsapp, text: 'WhatsApp alerts for you and your buyers' },
    { on: true, text: `Analytics: ${(f.analytics_days ?? 7) >= 365 ? '1 year' : `${f.analytics_days ?? 7} days`} of history` },
    { on: !!f.sales_tools, text: 'Coupons, limited-time offers, pay what you want' },
    { on: !!f.advanced_products, text: 'Bundles, memberships & upsells' },
    { on: !!f.gst_invoices, text: 'GST invoices for brand deals' },
    { on: !!f.leads_export, text: 'Export leads & audience (CSV)' },
    { on: !!f.tracking, text: 'Meta Pixel, Google Analytics & UTM links' },
    { on: (f.max_team ?? 0) > 0, text: f.max_team ? n(f.max_team, 'team member', 'team members') : 'No team access' },
    { on: !!f.remove_branding, text: 'Remove our branding' },
    { on: !!f.custom_domain, text: 'Custom domain' },
    { on: true, text: f.support === 'priority' ? 'Priority support' : f.support === 'email' ? 'Email support' : 'Help centre' },
  ]
}

/** Five short lines for a compact pricing card */
export function shortFeatures(f) {
  const lim = (v, one, many) => (UNLIMITED(v) ? `Unlimited ${many}` : v === 1 ? `1 ${one}` : `${fmt(v ?? 0)} ${many}`)
  const dm = UNLIMITED(f.max_automations) ? 'Unlimited DM automations' : `${f.max_automations} comment → DM automations, free`
  const days = (f.analytics_days ?? 7) >= 365 ? '1 year' : `${f.analytics_days ?? 7} days`
  return [
    { on: true, text: `${lim(f.max_pages, 'bio page', 'bio pages')} · ${lim(f.max_products, 'product', 'products')}` },
    { on: true, text: dm },
    { on: f.ig_posts_per_day != null, text: `Auto-post to Instagram: ${f.ig_posts_per_day} a day, ${f.ig_reels_per_month} Reels a month` },
    { on: true, text: f.commission_pct != null ? `${f.commission_pct}% platform charge on sales` : 'No platform charge' },
    { on: !!f.whatsapp, text: 'WhatsApp alerts for you and buyers' },
    { on: !!(f.custom_domain && f.remove_branding), text: 'Your own domain, no branding' },
    { on: true, text: `Analytics: ${days} of history` },
  ]
}

/** Every feature, grouped, for the "Compare all features" table. A value is true/false or a short string */
export const COMPARE = [
  { group: 'Your page', rows: [
    ['Bio pages', (f) => String(f.max_pages ?? 1)],
    ['Sub-pages per page', (f) => String(f.max_site_pages ?? 0)],
    ['Remove our branding', (f) => !!f.remove_branding],
    ['Custom domain', (f) => !!f.custom_domain],
  ] },
  { group: 'Selling', rows: [
    ['Live products', (f) => (UNLIMITED(f.max_products) ? 'Unlimited' : String(f.max_products))],
    ['Digital products, 1:1 calls, webinars, courses', () => true],
    ['Coupons, offers, pay what you want', (f) => !!f.sales_tools],
    ['Bundles, memberships, upsells', (f) => !!f.advanced_products],
    ['GST invoices', (f) => !!f.gst_invoices],
    ['Platform charge on each sale', (f) => (f.commission_pct != null ? `${f.commission_pct}%` : '—')],
  ] },
  { group: 'Instagram', rows: [
    ['Comment → DM automations', (f) => (UNLIMITED(f.max_automations) ? 'Unlimited' : `${f.max_automations} free`)],
    ['DMs per month', (f) => (UNLIMITED(f.dm_monthly_limit) ? 'Unlimited' : fmt(f.dm_monthly_limit))],
    ['Story-reply and DM-keyword automations', (f) => !Array.isArray(f.dm_triggers) || f.dm_triggers.length > 1],
    ['Follow to unlock, lead capture, follow-ups', (f) => !!f.dm_advanced],
    ['Auto-post scheduler: posts a day', (f) => (f.ig_posts_per_day != null ? String(f.ig_posts_per_day) : '—')],
    ['Auto-post scheduler: Reels a month', (f) => (f.ig_reels_per_month != null ? String(f.ig_reels_per_month) : '—')],
    ['Multi-photo carousels and Reels', () => true],
    ['Profile import, media kit, latest Reel', () => true],
  ] },
  { group: 'Alerts & audience', rows: [
    ['WhatsApp alerts for you and your buyers', (f) => !!f.whatsapp],
    ['Analytics history', (f) => ((f.analytics_days ?? 7) >= 365 ? '1 year' : `${f.analytics_days ?? 7} days`)],
    ['Export leads and audience (CSV)', (f) => !!f.leads_export],
    ['Meta Pixel, Google Analytics, UTM links', (f) => !!f.tracking],
  ] },
  { group: 'Team & support', rows: [
    ['Team members', (f) => (f.max_team ? String(f.max_team) : '—')],
    ['Support', (f) => (f.support === 'priority' ? 'Priority' : f.support === 'email' ? 'Email' : 'Help centre')],
  ] },
]
