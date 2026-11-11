import { LayoutGrid, Clapperboard, Lock, BriefcaseBusiness, CalendarDays, CirclePlay, Coffee, Heading, Image, Link2, Mail, MessageCircle, MessageSquareQuote, Minus, Music, ShoppingBag, Timer, Type, CircleHelp } from 'lucide-react'
import { InstagramIcon } from '../../components/icons'
import { INSTAGRAM_ENABLED } from '../../lib/config'

// Latest Reel reads from a connected Instagram account
const VIDEO_TYPES = ['youtube', 'instagram', ...(INSTAGRAM_ENABLED ? ['latest_reel'] : []), 'spotify']

export const newCard = () => ({ id: crypto.randomUUID(), title: 'New card', text: '', image: '', emoji: '', action: 'details', details: '', button: '', url: '', price: '' })

/** Which dashboard tab adds which section */
export const ADD_GROUPS = [
  { title: 'Basics', types: ['cards', 'link', 'image', 'text', 'heading', 'divider'] },
  { title: 'Let people reach you', types: ['lead_form', 'enquiry', 'whatsapp'] },
  { title: 'Videos and music', types: VIDEO_TYPES },
  { title: 'Build trust', types: ['testimonials', 'faq', 'countdown'] },
  { title: 'Earn', types: ['tip'] },
]
export const CONTENT_GROUPS = [
  { title: 'Forms', types: ['lead_form'] },
  { title: 'Videos and music', types: VIDEO_TYPES },
  { title: 'Trust and urgency', types: ['testimonials', 'faq', 'countdown'] },
]
export const CONTENT_TYPES = CONTENT_GROUPS.flatMap((g) => g.types)
/** A site has one of each of these. Adding one again opens the one already there */
export const ONE_PER_SITE = ['tip', 'products', 'enquiry', 'lead_form', 'latest_reel']

export const BLOCK_TYPES = {
  cards: { label: 'Cards', desc: 'A section of cards: 1 to 4 in a row', icon: LayoutGrid, color: 'bg-lime', defaults: { title: '', columns: 2, style: 'image', items: [] } },
  link: { label: 'Button', desc: 'Opens any website', icon: Link2, color: 'bg-lime', defaults: { title: '', url: '' } },
  whatsapp: { label: 'WhatsApp', desc: 'Chat or call button', icon: MessageCircle, color: 'bg-[#DCF8C6]', defaults: { title: '', phone: '', message: '', mode: 'chat' } },
  webinar: { label: 'Webinar', desc: 'Your Zoom registration link', icon: CalendarDays, color: 'bg-lilac-100', defaults: { title: '', date: '', time: '19:00', url: '', description: '', button: '' } },
  youtube: { label: 'YouTube', desc: 'Embed a video', icon: CirclePlay, color: 'bg-red-50', defaults: { url: '', title: '' } },
  instagram: { label: 'Instagram Reel', desc: 'Embed a Reel or post', icon: InstagramIcon, color: 'bg-pink-50', defaults: { url: '' } },
  spotify: { label: 'Spotify', desc: 'Track, album or podcast', icon: Music, color: 'bg-green-50', defaults: { url: '' } },
  lead_form: { label: 'Lead form', desc: 'Collect emails / WhatsApp', icon: Mail, color: 'bg-lime-200', defaults: { title: 'Stay in touch', description: '', collect: 'email', button: '' } },
  products: { label: 'Products', desc: 'Your shop: downloads, sessions, webinars', icon: ShoppingBag, color: 'bg-lime', defaults: { title: 'My products', columns: 2, style: 'image', limit: 0 } },
  locked: { label: 'Locked content', desc: 'Teaser that unlocks paid content', icon: Lock, color: 'bg-lilac-200', defaults: { title: '', teaser: '', product_id: '', button: '' } },
  latest_reel: { label: 'Latest Reel', desc: 'Auto-shows your newest Reel', icon: Clapperboard, color: 'bg-pink-50', defaults: { title: 'My latest Reel' } },
  tip: { label: 'Buy me a coffee', desc: 'Let fans support you with a small amount', icon: Coffee, color: 'bg-amber-50', defaults: { title: '', description: '', amounts: [49, 99, 199] } },
  enquiry: { label: 'Brand form', desc: 'Lets brands send you collab enquiries', icon: BriefcaseBusiness, color: 'bg-lilac-100', defaults: { title: 'Work with me', description: '', button: '' } },
  countdown: { label: 'Countdown', desc: 'Timer to a launch or live', icon: Timer, color: 'bg-red-50', defaults: { title: '', target: '', url: '', button: '', ended_text: '' } },
  faq: { label: 'FAQ', desc: 'Questions & answers', icon: CircleHelp, color: 'bg-cream-200', defaults: { title: 'FAQ', items: [{ q: '', a: '' }] } },
  testimonials: { label: 'Testimonials', desc: 'Reviews from fans & brands', icon: MessageSquareQuote, color: 'bg-cream-200', defaults: { title: 'What people say', items: [{ quote: '', name: '', role: '' }] } },
  image: { label: 'Image', desc: 'Banner or photo', icon: Image, color: 'bg-cream-200', defaults: { image: '', alt: '', url: '' } },
  heading: { label: 'Heading', desc: 'Section title', icon: Heading, color: 'bg-cream-200', defaults: { text: '' } },
  text: { label: 'Text', desc: 'A short paragraph', icon: Type, color: 'bg-cream-200', defaults: { text: '', align: 'center' } },
  divider: { label: 'Divider', desc: 'Separate sections', icon: Minus, color: 'bg-cream-200', defaults: {} },
}

/** One-line summary shown on a collapsed block card */
export function blockSummary(block) {
  const d = block.data || {}
  switch (block.type) {
    case 'link':
      return d.title || d.url || 'Untitled link'
    case 'whatsapp':
      return d.title || d.phone || 'WhatsApp button'
    case 'webinar':
      return d.title || 'Untitled webinar'
    case 'lead_form':
      return d.title || 'Lead form'
    case 'heading':
    case 'text':
      return d.text || BLOCK_TYPES[block.type].label
    case 'image':
      return d.alt || (d.image ? 'Image' : 'No image yet')
    case 'divider':
      return 'Divider'
    case 'cards':
      return `${d.title || 'Cards'} · ${(d.items || []).length} cards · ${d.columns === 'swipe' ? 'swipe' : `${d.columns || 2} in a row`}`
    case 'faq':
    case 'testimonials':
      return `${d.title || BLOCK_TYPES[block.type].label} · ${(d.items || []).length} items`
    case 'countdown':
      return d.title || d.target || 'Countdown'
    case 'locked':
      return d.title || 'Locked content'
    case 'latest_reel':
      return d.title || 'Latest Reel'
    default:
      return d.title || d.url || BLOCK_TYPES[block.type]?.label
  }
}

/** True when the block has the minimum content to render publicly */
export function blockIsComplete(block) {
  const d = block.data || {}
  switch (block.type) {
    case 'link':
      return Boolean(d.url || d.product_id)
    case 'youtube':
    case 'instagram':
    case 'spotify':
      return Boolean(d.url)
    case 'whatsapp':
      return Boolean(d.phone)
    case 'webinar':
      return Boolean(d.title && d.url)
    case 'image':
      return Boolean(d.image)
    case 'heading':
    case 'text':
      return Boolean(d.text)
    case 'cards':
      return (d.items || []).some((i) => i.title)
    case 'countdown':
      return Boolean(d.target)
    case 'locked':
      return Boolean(d.product_id)
    case 'faq':
      return (d.items || []).some((i) => i.q)
    case 'testimonials':
      return (d.items || []).some((i) => i.quote)
    default:
      return true
  }
}
