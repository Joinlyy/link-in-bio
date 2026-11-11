import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage, invokeFunction, supabase } from '../lib/supabase'
import { normalizeUrl } from '../lib/embeds'
import { useAuth } from './AuthContext'
import { useToast } from '../components/ui'
import { ONE_PER_SITE } from '../pages/dashboard/blockTypes'

const PageCtx = createContext(null)
const SAVE_DELAY = 600

const SELECTED_KEY = 'lib_page'

/**
 * Loads the pages the user owns or is a team member of, then the selected page's
 * blocks, sub-pages and products. Exposes optimistic, debounced mutations shared
 * by the editor, appearance and preview.
 */
export function PageProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const [pages, setPages] = useState([])
  const [page, setPage] = useState(null)
  const [role, setRole] = useState('owner') // owner | admin | editor | viewer
  const [blocks, setBlocks] = useState([])
  const [sitePages, setSitePages] = useState([])
  const [sitePageId, setSitePageId] = useState(null) // sub-page being edited (null = home)
  const [editTarget, setEditTarget] = useState(null) // section id tapped in the preview, or 'profile'
  const [instagram, setInstagram] = useState(null)
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | none | error
  const [saving, setSaving] = useState(0)
  const pageId = page?.id
  const pagePatch = useRef({})
  const pageTimer = useRef(null)
  const blockTimers = useRef(new Map())
  const blockPatches = useRef(new Map())
  const pageIdRef = useRef(null)

  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem(SELECTED_KEY)
    } catch {
      return null
    }
  })

  // Session refreshes give a new user object, so this follows the id: they must not reload the page
  const userId = user?.id
  const load = useCallback(async () => {
    if (!userId) return
    await supabase.rpc('accept_invites') // link any pending team invites to this account
    const { data: list, error } = await supabase.from('pages').select('*').order('created_at')
    if (error) return setStatus('error')
    // Admins can read every page; only show pages they own or were invited to
    const { data: memberships } = await supabase.from('page_members').select('page_id, role').eq('user_id', userId)
    const memberRole = Object.fromEntries((memberships || []).map((m) => [m.page_id, m.role]))
    const mine = (list || []).filter((p) => p.owner_id === userId || memberRole[p.id])
    setPages(mine)
    if (!mine.length) return setStatus('none')
    const p = mine.find((x) => x.id === selectedId) || mine.find((x) => x.owner_id === userId) || mine[0]
    const [{ data: b }, { data: ig }, { data: pr }, { data: sp }] = await Promise.all([
      supabase.from('blocks').select('*').eq('page_id', p.id).order('position').order('created_at'),
      supabase.from('instagram_accounts').select('*').eq('owner_id', p.owner_id).maybeSingle(),
      supabase.from('products').select('*').eq('page_id', p.id).order('position').order('created_at'),
      supabase.from('site_pages').select('*').eq('page_id', p.id).order('position').order('created_at'),
    ])
    // Edits still waiting to save win over what was just read
    setPage(p.id === pageIdRef.current ? { ...p, ...pagePatch.current } : p)
    pageIdRef.current = p.id
    setRole(p.owner_id === userId ? 'owner' : memberRole[p.id])
    setBlocks((b || []).map((row) => {
      const pending = blockPatches.current.get(row.id)
      return pending ? { ...row, ...pending } : row
    }))
    setInstagram(ig || null)
    setProducts(pr || [])
    setSitePages(sp || [])
    setSitePageId((cur) => ((sp || []).some((x) => x.id === cur) ? cur : null))
    setStatus('ready')
  }, [userId, selectedId])

  const selectPage = useCallback((id) => {
    try {
      localStorage.setItem(SELECTED_KEY, id)
    } catch {
      /* ignore */
    }
    setStatus('loading')
    setSitePageId(null)
    setSelectedId(id)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const track = useCallback(async (promise, onError) => {
    setSaving((n) => n + 1)
    try {
      const { error } = await promise
      if (error) throw error
    } catch (err) {
      toast(errorMessage(err), 'error')
      onError?.()
    } finally {
      setSaving((n) => n - 1)
    }
  }, [toast])

  // ---- page ----
  const flushPage = useCallback(async () => {
    clearTimeout(pageTimer.current)
    const patch = pagePatch.current
    pagePatch.current = {}
    if (!pageId || !Object.keys(patch).length) return
    await track(supabase.from('pages').update(patch).eq('id', pageId), load)
  }, [pageId, track, load])

  // A patch can be a function of the latest page, so quick edits never overwrite each other
  const latestPage = useRef(page)
  latestPage.current = page
  const updatePage = useCallback((input, { immediate = false } = {}) => {
    const patch = typeof input === 'function' ? input(latestPage.current) : input
    latestPage.current = { ...latestPage.current, ...patch }
    setPage((p) => ({ ...p, ...patch }))
    pagePatch.current = { ...pagePatch.current, ...patch }
    clearTimeout(pageTimer.current)
    if (immediate) flushPage()
    else pageTimer.current = setTimeout(flushPage, SAVE_DELAY)
  }, [flushPage])

  // ---- blocks ----
  const checkedUrls = useRef(new Set())
  const checkLink = useCallback(async (url, blockId) => {
    if (checkedUrls.current.has(url) || !/^https?:\/\/[^/]+\.[^/]+/.test(url)) return
    checkedUrls.current.add(url)
    try {
      const res = await invokeFunction('check-url', { url, block_id: blockId })
      if (res?.safe === false) {
        toast('That link was flagged as unsafe by Google and has been hidden.', 'error')
        load()
      }
    } catch {
      /* checking is best-effort */
    }
  }, [toast, load])

  const flushBlock = useCallback(async (id) => {
    clearTimeout(blockTimers.current.get(id))
    blockTimers.current.delete(id)
    const patch = blockPatches.current.get(id)
    blockPatches.current.delete(id)
    if (!patch) return
    // Half-typed links ("youtube.com/…") are saved with https:// so the DB check passes
    if (patch.data?.url) patch.data = { ...patch.data, url: normalizeUrl(patch.data.url) }
    await track(supabase.from('blocks').update(patch).eq('id', id), load)
    if (patch.data?.url) checkLink(patch.data.url, id)
  }, [track, load, checkLink])

  const updateBlock = useCallback((id, patch) => {
    setBlocks((list) =>
      list.map((b) => {
        if (b.id !== id) return b
        const next = { ...b, ...patch, data: patch.data ? { ...b.data, ...patch.data } : b.data }
        const pending = blockPatches.current.get(id) || {}
        blockPatches.current.set(id, { ...pending, ...patch, ...(patch.data ? { data: next.data } : {}) })
        return next
      }).sort((a, b) => (patch.position === undefined ? 0 : a.position - b.position)),
    )
    clearTimeout(blockTimers.current.get(id))
    blockTimers.current.set(id, setTimeout(() => flushBlock(id), SAVE_DELAY))
  }, [flushBlock])

  /**
   * The page in the top menu that holds a kind of content, created the first time it's needed.
   * A full page allowance keeps things on Home (null).
   */
  const autoPage = useCallback(async (kind) => {
    if (!page) return null
    const found = sitePages.find((s) => s.slug === kind)
    if (found) return found.id
    const hi = page.language === 'hi'
    const title = kind === 'shop' ? (hi ? 'दुकान' : 'Shop') : (hi ? 'कंटेंट' : 'Content')
    const { data: row, error } = await supabase
      .from('site_pages')
      .insert({ page_id: page.id, slug: kind, title, position: sitePages.length })
      .select()
      .single()
    if (error) {
      toast(`Added to Home, because a new ${title} page couldn’t be created: ${errorMessage(error)}`, 'error')
      return null
    }
    setSitePages((list) => [...list, row])
    return row.id
  }, [page, sitePages, toast])

  const addBlock = useCallback(async (type, data = {}, { sitePage } = {}) => {
    if (!page) return null
    // Only one of these per site: hand back the one that's there, marked so callers can tell
    const existing = ONE_PER_SITE.includes(type) && blocks.find((b) => b.type === type)
    if (existing) return { ...existing, existed: true }
    const position = blocks.length ? Math.max(...blocks.map((b) => b.position)) + 1 : 0
    setSaving((n) => n + 1)
    const { data: row, error } = await supabase
      .from('blocks')
      .insert({ page_id: page.id, site_page_id: sitePage === undefined ? sitePageId : sitePage, type, data, position })
      .select()
      .single()
    setSaving((n) => n - 1)
    if (error) {
      toast(errorMessage(error), 'error')
      return null
    }
    setBlocks((list) => [...list, row])
    return row
  }, [page, blocks, toast, sitePageId])

  /** Adds the home page's Products section if the page has none yet */
  const ensuring = useRef(false)
  const ensureProductsBlock = useCallback(async () => {
    if (!page || ensuring.current || blocks.some((b) => b.type === 'products')) return
    ensuring.current = true
    const shop = await autoPage('shop')
    const position = blocks.length ? Math.max(...blocks.map((b) => b.position)) + 1 : 0
    const { data: row, error } = await supabase
      .from('blocks')
      .insert({ page_id: page.id, site_page_id: shop, type: 'products', data: { title: 'My products', columns: 2, style: 'image', limit: 0 }, position })
      .select()
      .single()
    ensuring.current = false
    if (!error) setBlocks((list) => [...list, row])
  }, [page, blocks, autoPage])

  /** Shop leaves the top menu while it has nothing to show */
  const syncShopMenu = useCallback(async (hasProducts) => {
    const shop = sitePages.find((s) => s.slug === 'shop')
    if (!shop) return
    const held = blocks.filter((b) => b.site_page_id === shop.id)
    const show = held.some((b) => b.type !== 'products') || (hasProducts && held.length > 0)
    if (shop.show_in_nav === show) return
    setSitePages((list) => list.map((s) => (s.id === shop.id ? { ...s, show_in_nav: show } : s)))
    await track(supabase.from('site_pages').update({ show_in_nav: show }).eq('id', shop.id), load)
  }, [sitePages, blocks, track, load])

  const removeBlock = useCallback(async (id) => {
    clearTimeout(blockTimers.current.get(id))
    blockPatches.current.delete(id)
    const removed = blocks.find((b) => b.id === id)
    setBlocks((list) => list.filter((b) => b.id !== id))
    await track(supabase.from('blocks').delete().eq('id', id), load)
    // The Content page goes away with its last section, so the menu never leads to an empty page
    const content = sitePages.find((s) => s.slug === 'content')
    if (content && removed?.site_page_id === content.id && !blocks.some((b) => b.id !== id && b.site_page_id === content.id)) {
      setSitePages((list) => list.filter((s) => s.id !== content.id))
      setSitePageId((cur) => (cur === content.id ? null : cur))
      await track(supabase.from('site_pages').delete().eq('id', content.id), load)
    }
  }, [track, load, blocks, sitePages])

  const reorderBlocks = useCallback(async (ids) => {
    // Reorders one sub-page's blocks; blocks on other sub-pages keep their place
    setBlocks((list) => {
      const pos = new Map(ids.map((id, i) => [id, i]))
      return list.map((b) => (pos.has(b.id) ? { ...b, position: pos.get(b.id) } : b)).sort((a, b) => a.position - b.position)
    })
    await track(supabase.rpc('reorder_blocks', { p_page_id: pageId, p_ids: ids }), load)
  }, [pageId, track, load])

  // Flush pending edits when leaving the dashboard (refs keep this effect mounted once)
  const flushers = useRef({})
  flushers.current = { flushPage, flushBlock }
  useEffect(() => {
    const flushAll = () => {
      flushers.current.flushPage()
      for (const id of [...blockPatches.current.keys()]) flushers.current.flushBlock(id)
    }
    window.addEventListener('beforeunload', flushAll)
    return () => {
      window.removeEventListener('beforeunload', flushAll)
      flushAll()
    }
  }, [])

  const value = useMemo(
    () => ({
      pages, page, role, canEdit: role !== 'viewer', isOwner: role === 'owner',
      blocks, sitePages, sitePageId, setSitePageId, setSitePages, editTarget, setEditTarget,
      instagram, products, status, saving: saving > 0,
      reload: load, selectPage, setInstagram, setProducts, autoPage, ensureProductsBlock, syncShopMenu, updatePage, flushPage, addBlock, updateBlock, removeBlock, reorderBlocks,
    }),
    [pages, page, role, blocks, sitePages, sitePageId, editTarget, instagram, products, status, saving, load, selectPage, autoPage, ensureProductsBlock, syncShopMenu, updatePage, flushPage, addBlock, updateBlock, removeBlock, reorderBlocks],
  )

  return <PageCtx.Provider value={value}>{children}</PageCtx.Provider>
}

export function usePage() {
  return useContext(PageCtx)
}
