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
    { on: true, text: f.commission_pct != null ? `${f.commission_pct}% fee on sales through our checkout` : 'No fee on sales' },
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
