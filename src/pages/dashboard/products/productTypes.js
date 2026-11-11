import { CalendarDays, Crown, Download, ExternalLink, Lock, MessageCircleQuestionMark, Package, Video } from 'lucide-react'

/** What creators can add. The other types stay only so products already made keep working */
export const MAIN_PRODUCT_TYPES = ['digital', 'session', 'webinar', 'link', 'question']

export const PRODUCT_TYPES = {
  digital: {
    label: 'Digital product',
    desc: 'PDFs, presets, templates, ebooks, wallpapers',
    icon: Download,
    color: 'bg-lime',
    defaults: { data: {}, private: { instructions: '' } },
  },
  bundle: {
    label: 'Bundle',
    desc: 'Sell several downloads or guides together for less',
    icon: Package,
    color: 'bg-lime-200',
    defaults: { data: { items: [] }, private: { instructions: '' } },
  },
  content: {
    label: 'Paid content',
    desc: 'Locked text, links or a resource list unlocked after purchase',
    icon: Lock,
    color: 'bg-lilac-200',
    defaults: { data: {}, private: { content: '', instructions: '' } },
  },
  membership: {
    label: 'Membership',
    desc: 'Monthly or yearly access to a community + members-only pages',
    icon: Crown,
    color: 'bg-[#FFE3A3]',
    defaults: { data: { interval: 'month' }, private: { invite_url: '', instructions: '' } },
  },
  question: {
    label: 'Paid message',
    desc: 'Fans pay to send you a message and you reply in writing',
    icon: MessageCircleQuestionMark,
    color: 'bg-[#D9F0EC]',
    defaults: { data: { response_days: 3 }, private: {} },
  },
  session: {
    label: '1:1 session',
    desc: 'Paid video calls, consultations, mentoring, packages',
    icon: Video,
    color: 'bg-lilac-100',
    defaults: {
      data: {
        duration: 30,
        buffer: 10,
        advance_days: 14,
        sessions: 1,
        reschedule_hours: 24,
        availability: [
          { day: 1, start: '18:00', end: '21:00' },
          { day: 3, start: '18:00', end: '21:00' },
          { day: 6, start: '11:00', end: '14:00' },
        ],
      },
      private: { meeting_url: '', instructions: '' },
    },
  },
  webinar: {
    label: 'Webinar',
    desc: 'Paid or free Zoom webinars with seats',
    icon: CalendarDays,
    color: 'bg-[#FFE8D6]',
    defaults: { data: { starts_at: '', duration: 60, capacity: '' }, private: { meeting_url: '', instructions: '' } },
  },
  link: {
    label: 'Affiliate product',
    desc: 'Sold on Amazon, Myntra or any store: add an image, price and buy link',
    icon: ExternalLink,
    color: 'bg-cream-200',
    defaults: { data: { url: '', label: '' }, private: {} },
  },
}

/** Types that can be put inside a bundle */
export const BUNDLE_ITEM_TYPES = ['digital', 'content']
/** Types that can be offered as a one-click upsell */
export const UPSELL_TYPES = ['digital', 'content', 'bundle']

/** Sale price currently active? (sale_ends_at null = runs until removed) */
export function saleActive(p, now = Date.now()) {
  return p.sale_price_inr != null && p.sale_price_inr !== '' && (!p.sale_ends_at || new Date(p.sale_ends_at).getTime() > now)
}

export const INTERVAL_LABEL = { month: 'month', year: 'year' }

/** What still stops a product from going live, or null */
export function missing(p) {
  const blank = (v) => v == null || v === ''
  if (!p.title.trim()) return 'Add a title'
  if (p.type === 'digital' && !p.file_path) return 'Upload the file buyers will download'
  if (p.type === 'link' && !p.data.url) return 'Add the buy link'
  if (p.type === 'webinar' && !p.data.starts_at) return 'Set the webinar date & time'
  if (p.type === 'session' && !(p.data.availability || []).length) return 'Add at least one availability window'
  if (p.type === 'bundle' && (p.data.items || []).length < 2) return 'Pick at least 2 products for the bundle'
  if (p.type === 'content' && !(p.private.content || '').trim()) return 'Add the content buyers unlock'
  if (p.type === 'membership' && !(p.private.invite_url || '').trim() && !(p.private.instructions || '').trim()) return 'Add an invite link or joining instructions for members'
  if (!blank(p.sale_price_inr) && Number(p.sale_price_inr) >= Number(p.price_inr)) return 'The offer price must be lower than the regular price'
  if (p.data.upsell_product_id && p.data.upsell_product_id === p.id) return 'A product can’t be its own upsell'
  return null
}
