import { lookFor, restyle, RESTYLED_TYPES, shapeTemplate } from './templates'
import { supabase } from './supabase'

function rows(pageId, sitePageId, blocks) {
  return blocks.map((b, i) => ({
    page_id: pageId, site_page_id: sitePageId, type: b.type, data: b.data, position: i,
    is_active: b.is_active ?? true, starts_at: b.starts_at ?? null, ends_at: b.ends_at ?? null,
  }))
}

/**
 * Puts the creator's whole site into a design: layout, fonts, buttons, colours and how product and
 * card sections are laid out. Their pages, sections and content stay exactly where they are.
 * Returns what changed, so it can be undone.
 */
export async function applyLook(page, template) {
  const old = page.theme || {}
  const { data: styled, error: readError } = await supabase.from('blocks').select('id, type, data').eq('page_id', page.id).in('type', RESTYLED_TYPES)
  if (readError) throw readError
  const { error } = await supabase.from('pages').update({ theme: lookFor(template, old) }).eq('id', page.id)
  if (error) throw error
  const sections = styled.map((b) => ({ id: b.id, columns: b.data.columns ?? null, style: b.data.style ?? null }))
  for (const b of styled) {
    const { error: blockError } = await supabase.from('blocks').update({ data: restyle(b, template).data }).eq('id', b.id)
    if (blockError) throw blockError
  }
  return { theme: old, sections }
}

/**
 * Moves a page into a template's design and structure. The creator's own sections stay and fill
 * the template's places; sections they haven't made stay samples only they can see.
 * The new home sections go in before the old ones come out, so a failure can't empty the page.
 */
export async function applyTemplate(page, template, { leadPopup = false } = {}) {
  const check = ({ error }) => {
    if (error) throw error
  }
  const { data: existing, error } = await supabase.from('blocks').select('*').eq('page_id', page.id)
  if (error) throw error
  const shaped = shapeTemplate(template, existing)
  shaped.blocks = shaped.blocks.map((b) => restyle(b, template))
  shaped.pages = shaped.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => restyle(b, template)) }))
  if (leadPopup) shaped.blocks = shaped.blocks.map((b) => (b.type === 'lead_form' ? { ...b, data: { ...b.data, popup: true } } : b))
  check(await supabase.from('blocks').insert(rows(page.id, null, shaped.blocks)))
  if (existing.length) check(await supabase.from('blocks').delete().in('id', existing.map((b) => b.id)))
  check(await supabase.from('site_pages').delete().eq('page_id', page.id))
  check(
    await supabase
      .from('pages')
      .update({ theme: { ...lookFor(template, page.theme), structure: template.structure }, language: template.language || 'en' })
      .eq('id', page.id),
  )

  for (const [i, sub] of shaped.pages.entries()) {
    const { data, error: pageError } = await supabase
      .from('site_pages')
      .insert({ page_id: page.id, slug: sub.slug, title: sub.title, position: i })
      .select()
      .single()
    if (pageError) throw pageError
    check(await supabase.from('blocks').insert(rows(page.id, data.id, sub.blocks)))
  }
}
