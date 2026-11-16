// Products sold on another website are stored with type 'link'. A course is a 'link' product with
// data.kind = 'course': it has course details and opens a details sheet; a brand product opens the store
// link straight away. Neither is ever checked out on our site. Dependency-free: used by the public bundle.

/** The kind shown to people: the product type, or 'course' for an external course */
export const productKind = (p) => (p?.type === 'link' && p?.data?.kind === 'course' ? 'course' : p?.type)

/** Bought on another website (brand product or external course) */
export const isExternal = (p) => p?.type === 'link'

/** Course detail lines ("What you'll learn"), one per line */
export const courseHighlights = (p) =>
  String(p?.data?.highlights || '').split('\n').map((s) => s.replace(/^[\s•\-*]+/, '').trim()).filter(Boolean).slice(0, 12)
