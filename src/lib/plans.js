/** A plan's limits in plain words. `on` is false for things the plan doesn't include */
export function featureList(f) {
  const n = (v, one, many) => (v === 1 ? `1 ${one}` : `${v ?? 0} ${many}`)
  return [
    { on: true, text: n(f.max_pages, 'bio page', 'bio pages') },
    { on: true, text: `${f.max_site_pages ?? 0} sub-pages per page` },
    { on: (f.max_team ?? 0) > 0, text: f.max_team ? `${n(f.max_team, 'team member', 'team members')}` : 'No team access' },
    { on: true, text: `${f.max_products ?? 0} live products per page` },
    { on: !!f.remove_branding, text: 'Remove our branding' },
    { on: !!f.custom_domain, text: 'Custom domain' },
  ]
}
