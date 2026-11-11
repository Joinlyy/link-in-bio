// Ready-made pages. Every template is complete: a real layout, a clear primary action
// near the top, 5-7 focused blocks and a trust line. Sample content is flagged
// (data.sample) so the editor can remind creators to replace it.

const img = (id, w = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`
const inDays = (n) => new Date(Date.now() + n * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10)
const inDaysTime = (n) => `${inDays(n)}T19:00`
const SAMPLE_URL = 'https://example.com'

// ---- block helpers ----
const link = (title, emoji, subtitle, extra = {}) => ({ type: 'link', data: { title, emoji, subtitle, url: SAMPLE_URL, sample: true, ...extra } })
const main = (title, emoji, subtitle, extra = {}) => link(title, emoji, subtitle, { primary: true, ...extra })
const tile = (title, photo, subtitle) => link(title, undefined, subtitle, { thumbnail: img(photo, 400) })
const wa = (title) => ({ type: 'whatsapp', data: { title, phone: '9999999999', message: 'Hi! I found you through your page.', mode: 'chat', sample: true } })
const text = (t, align = 'center') => ({ type: 'text', data: { text: t, align, sample: true } })
const photo = (id, alt) => ({ type: 'image', data: { image: img(id, 900), alt, sample: true } })
const video = (title) => ({ type: 'youtube', data: { url: 'https://youtu.be/jNQXAC9IVRw', title, sample: true } })
const spotify = () => ({ type: 'spotify', data: { url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', sample: true } })
const webinar = (title, description, button) => ({ type: 'webinar', data: { title, description, button, date: inDays(14), time: '19:00', url: SAMPLE_URL, sample: true } })
const lead = (title, description, button, collect = 'email') => ({ type: 'lead_form', data: { title, description, button, collect } })
const countdown = (title, button) => ({ type: 'countdown', data: { title, target: inDaysTime(10), url: SAMPLE_URL, button, sample: true } })
const faq = (title, items) => ({ type: 'faq', data: { title, items: items.map(([q, a]) => ({ q, a })), sample: true } })
const reviews = (title, items) => ({ type: 'testimonials', data: { title, items: items.map(([quote, name, role]) => ({ quote, name, role })), sample: true } })
const brands = (title, description) => ({ type: 'enquiry', data: { title, description, sample: true } })
const tip = (title, description) => ({ type: 'tip', data: { title, description, amounts: [49, 99, 199], sample: true } })

// ---- photos ----
const P = {
  woman: '1544005313-94ddf0286df2', man: '1506794778202-cad84cf45f1d', man2: '1507003211169-0a1dd7228f2d',
  fashion: '1483985988355-763728e1935b', store: '1441986300917-64674bd600d8', model: '1487412720507-e7ab37603c6f', portrait: '1517841905240-472988babdf9',
  gym: '1534438327276-14e5300c3a48', workout: '1571019613454-1cb2f99b2d8b', lift: '1517836357463-d25dfeac3438', yoga: '1506126613408-eca07ce68773',
  salad: '1546069901-ba9599a7e63c', food: '1504674900247-0877df9cc836', pizza: '1565299624946-b28f40a0ae38', healthy: '1490645935967-10de6ba17061',
  travel: '1488646953014-85cb44e25828', lake: '1476514525535-07fb3b4ae5f1', india: '1524492412937-b28074a5d7da',
  school: '1503676260728-1c00da094a0b', books: '1456513080510-7bf3a84b82f8', finance: '1554224155-6726b3ff858f', dev: '1498050108023-c5249f4df085', code: '1518186285589-2f7649de83e0',
  gaming: '1511512578047-dfb367046420', concert: '1493225457124-a3eb161ffa5f', studio: '1511379938547-c1f69419868d', dance: '1508700115892-45ecd05ae2ad',
  family: '1503454537195-1dcabb73ffb9', art: '1460661419201-fd4cecdf8a8b', craft: '1452587925148-ce544e77e70d', camera: '1516035069371-29a1b244cc32', mic: '1478737270239-2f02b77fc618', team: '1522202176988-66273c2fd55f',
}

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/**
 * A template is a complete design: header layout, fonts, button shape, corners, colours and how
 * sections lay out their cards. Text and buttons stay readable on whatever they sit on. Stock
 * cover photos are never saved: the hero uses the creator's own cover or profile photo.
 */
const theme = ({ bg, bg2, bgType = 'solid', text, buttonBg, buttonText, accent, font = 'dm', headingFont = 'bricolage', layout = 'classic', radius = 'pill', buttonStyle = 'fill', cardBg }) => {
  const gradient = bgType === 'gradient' && layout !== 'card'
  // On the floating-card layout, text sits on the card, not on the page background
  const surface = layout === 'card' ? cardBg || '#FFFFFF' : bg
  const worst = (color) => Math.min(contrast(color, surface), gradient ? contrast(color, bg2) : 21)
  const ink = worst(text) >= 4 ? text : worst('#FFFFFF') > worst('#15161A') ? '#FFFFFF' : '#15161A'
  const readableButton = worst(buttonBg) >= 2 && contrast(buttonText, buttonBg) >= 3
  return {
    bgType, bg, ...(bgType === 'gradient' ? { bg2 } : {}), ...(layout === 'card' ? { cardBg: surface } : {}), text: ink, accent,
    buttonBg: readableButton ? buttonBg : ink,
    buttonText: readableButton ? buttonText : (contrast(ink, '#FFFFFF') > contrast(ink, '#15161A') ? '#FFFFFF' : '#15161A'),
    radius, buttonStyle, layout, font, headingFont,
  }
}

/** The designs shown first, so nobody starts with 33 choices */
export const STARTER_TEMPLATES = ['spotlight', 'iron-mode', 'kitchen-stories', 'wanderlust', 'essentials', 'vogue-edit', 'coach-pro', 'dev-terminal', 'bento', 'street-drop', 'art-studio', 'skin-diary']

export const TEMPLATE_CATEGORIES = ['All', 'Creator', 'Fashion & Beauty', 'Fitness & Wellness', 'Food', 'Travel', 'Education', 'Business', 'Tech & Gaming', 'Entertainment', 'Art & Photo', 'Hindi']

export const TEMPLATES = [
  {
    id: 'spotlight', name: 'Spotlight', category: 'Creator', blurb: 'Big photo up top. Your newest thing right under it.',
    sampleName: 'Ananya Rao', bio: 'Lifestyle creator from Bengaluru. New videos every Friday.', avatar: P.portrait,
    theme: theme({ layout: 'hero', cover: img(P.portrait, 1000), bg: '#15161A', text: '#FFFFFF', buttonBg: '#FFFFFF', buttonText: '#15161A', accent: '#D5F05C', tagline: '2.1L followers · 40+ brand collabs' }),
    blocks: [main('Watch my latest video', '▶️', 'New this Friday'), link('Shop my favourites', '🛍️'), link('My free weekly letter', '💌'), wa('Brand enquiries on WhatsApp'), brands('Work with me', 'Reels, Stories and long-form integrations.')],
  },
  {
    id: 'essentials', name: 'Essentials', category: 'Creator', blurb: 'Clean, simple and quick to set up.',
    sampleName: 'Rohan Mehta', bio: 'I make short videos about money, careers and life in your 20s.', avatar: P.man,
    theme: theme({ bg: '#F2F1EC', text: '#15161A', buttonBg: '#15161A', buttonText: '#FFFFFF', accent: '#D5F05C', tagline: 'Seen by 5 lakh+ people a month' }),
    blocks: [main('Start with my best video', '⭐', 'Most watched this year'), link('Join my WhatsApp channel', '💬'), link('Tools I actually use', '🧰'), link('Read my newsletter', '📬'), reviews('What people say', [['Finally someone who explains this simply.', 'Priya', 'Subscriber'], ['Helped me negotiate a better offer.', 'Arjun', 'Viewer']])],
  },
  {
    id: 'launch-drop', name: 'Launch Drop', category: 'Creator', blurb: 'Countdown-led page for a launch or big announcement.',
    sampleName: 'KIRA', bio: 'Something big is coming. Be first in line.', avatar: P.model,
    theme: theme({ layout: 'poster', bg: '#15161A', text: '#FFFFFF', buttonBg: '#D5F05C', buttonText: '#15161A', accent: '#D5F05C', font: 'space', headingFont: 'space', tagline: 'Limited first drop' }),
    blocks: [countdown('The drop goes live in', 'Remind me'), lead('Get early access', 'First 100 people get 20% off.', 'Get early access'), link('See the teaser', '🎬'), link('Follow the journey', '📸')],
  },
  {
    id: 'bento', name: 'Bento Grid', category: 'Creator', blurb: 'Photo tiles instead of a long list of buttons.',
    sampleName: 'Meera Joshi', bio: 'Everyday style, food and travel.', avatar: P.woman,
    theme: theme({ bg: '#EFECFE', bgType: 'gradient', bg2: '#DFDAFB', text: '#15161A', buttonBg: '#15161A', buttonText: '#FFFFFF', accent: '#B9AFF5', radius: 'rounded', tagline: 'Featured in Femina' }),
    blocks: [main('My new Reel is up', '🎥', 'Watch now'), tile('Outfits', P.fashion, 'Shop the looks'), tile('Recipes', P.salad, 'Quick & healthy'), tile('Travel', P.lake, 'Trip guides'), tile('Wellness', P.yoga, 'Morning routine'), wa('Say hi on WhatsApp')],
  },

  // ---- Fashion & Beauty ----
  {
    id: 'vogue-edit', name: 'The Edit', category: 'Fashion & Beauty', blurb: 'Editorial fashion magazine look.',
    sampleName: 'Sana Kapoor', bio: 'Fashion stylist. Affordable looks that photograph well.', avatar: P.model,
    theme: theme({ layout: 'hero', cover: img(P.fashion, 1000), bg: '#FFFFFF', text: '#15161A', buttonBg: '#15161A', buttonText: '#FFFFFF', accent: '#E8D5C4', font: 'dm', headingFont: 'playfair', radius: 'square', buttonStyle: 'outline', tagline: 'As seen in Vogue India' }),
    blocks: [main('Shop this week’s edit', '🖤', '12 looks under ₹2,000'), link('Wedding season lookbook', '✨'), link('Style with me: 1:1 session', '🪞', '30 minutes on video'), brands('Collaborate', 'For fashion and lifestyle brands.')],
  },
  {
    id: 'street-drop', name: 'Street Drop', category: 'Fashion & Beauty', blurb: 'Shoppable photo grid for outfits and hauls.',
    sampleName: 'Kabir Style', bio: 'Streetwear on a student budget.', avatar: P.man2,
    theme: theme({ bg: '#15161A', text: '#FFFFFF', buttonBg: '#FFFFFF', buttonText: '#15161A', accent: '#F26B5B', font: 'space', headingFont: 'space', radius: 'rounded', tagline: 'New fits every Sunday' }),
    blocks: [main('This week’s haul', '🔥', 'All links inside'), tile('Sneakers', P.store, 'Under ₹3K'), tile('Jackets', P.fashion, 'Winter picks'), tile('Accessories', P.model, 'Small upgrades'), tile('Full fits', P.portrait, 'Copy the look'), wa('Ask me for sizing')],
  },
  {
    id: 'rose-glow', name: 'Rose Glow', category: 'Fashion & Beauty', blurb: 'Soft, romantic page for beauty creators.',
    sampleName: 'Ishita Beauty', bio: 'Honest skincare for Indian skin. No sponsored lies.', avatar: P.portrait,
    theme: theme({ layout: 'banner', cover: img(P.model, 1000), bg: '#FFF1F2', text: '#4C0519', buttonBg: '#E11D48', buttonText: '#FFFFFF', accent: '#FDA4AF', headingFont: 'playfair', radius: 'rounded', tagline: 'Trusted by 80K+ readers' }),
    blocks: [main('Get my 5-step skincare routine', '🌸', 'Free PDF'), link('Products I repurchase', '🧴'), link('Book a skin consult', '💬', '₹499 · 20 minutes'), reviews('Real results', [['My acne cleared in 8 weeks.', 'Nidhi', 'Follower']]), faq('Quick answers', [['Do you do paid reviews?', 'Only products I’ve used for 30+ days, always disclosed.']])],
  },
  {
    id: 'skin-diary', name: 'Skin Diary', category: 'Fashion & Beauty', blurb: 'Floating card layout with a calm lilac feel.',
    sampleName: 'Tara Nair', bio: 'Makeup tutorials for beginners.', avatar: P.woman,
    theme: theme({ layout: 'card', cardBg: '#FFFFFF', bg: '#DFDAFB', bgType: 'gradient', bg2: '#B9AFF5', text: '#15161A', buttonBg: '#15161A', buttonText: '#FFFFFF', accent: '#B9AFF5', tagline: '120+ free tutorials' }),
    blocks: [main('Start the beginner makeup course', '💄', 'Free 7-day series'), link('My everyday kit under ₹1,500', '👝'), video('Latest tutorial'), lead('Get new tutorials', 'One email every Sunday.', 'Send them to me')],
  },

  // ---- Fitness & Wellness ----
  {
    id: 'iron-mode', name: 'Iron Mode', category: 'Fitness & Wellness', blurb: 'Bold, high-energy page for trainers.',
    sampleName: 'Coach Vikram', bio: 'Certified trainer. 500+ transformations.', avatar: P.man,
    theme: theme({ layout: 'hero', cover: img(P.gym, 1000), bg: '#15161A', text: '#FFFFFF', buttonBg: '#EF4444', buttonText: '#FFFFFF', accent: '#EF4444', font: 'space', headingFont: 'space', radius: 'square', tagline: '500+ transformations' }),
    blocks: [main('Start my 12-week programme', '💪', 'Limited slots this month'), link('Free home workout plan', '📄'), link('Book a 1:1 consultation', '📞', '₹999 · 30 minutes'), reviews('Transformations', [['Lost 14 kg in 4 months.', 'Amit', 'Client'], ['Finally consistent for the first time.', 'Pooja', 'Client']]), wa('Ask me anything on WhatsApp')],
  },
  {
    id: 'yoga-flow', name: 'Morning Flow', category: 'Fitness & Wellness', blurb: 'Calm gradient for yoga and wellness.',
    sampleName: 'Aditi Yoga', bio: 'Gentle yoga and breathwork for busy people.', avatar: P.woman,
    theme: theme({ bg: '#0F6B5F', bgType: 'gradient', bg2: '#15161A', text: '#FFFFFF', buttonBg: '#FFFFFF', buttonText: '#0F6B5F', accent: '#D5F05C', font: 'outfit', headingFont: 'outfit', tagline: 'RYT-500 certified' }),
    blocks: [main('Join tomorrow’s live class', '🧘', '7 AM IST on Zoom'), webinar('21-day yoga challenge', 'A short guided practice every morning.', 'Reserve my spot'), link('Free 10-minute morning flow', '🌅'), wa('Questions? Message me')],
  },
  {
    id: 'nourish', name: 'Nourish', category: 'Fitness & Wellness', blurb: 'Fresh photo banner for nutritionists.',
    sampleName: 'Dr. Riya Sen', bio: 'Clinical nutritionist. Indian diet plans that actually fit your life.', avatar: P.portrait,
    theme: theme({ layout: 'banner', cover: img(P.healthy, 1000), bg: '#F7FBEF', text: '#1E3A1A', buttonBg: '#3F7D2C', buttonText: '#FFFFFF', accent: '#D5F05C', radius: 'rounded', tagline: '10+ years in practice' }),
    blocks: [main('Get a personal diet plan', '🥗', 'Starts at ₹1,499'), link('Free PCOS meal guide', '📘'), link('Book a video consult', '🩺'), faq('Good to know', [['Will I have to stop eating rice?', 'No. Plans are built around the food you already eat at home.']])],
  },

  // ---- Food ----
  {
    id: 'kitchen-stories', name: 'Kitchen Stories', category: 'Food', blurb: 'Warm food photography with recipes first.',
    sampleName: 'Neha’s Kitchen', bio: 'Easy weeknight recipes in 20 minutes or less.', avatar: P.woman,
    theme: theme({ layout: 'hero', cover: img(P.food, 1000), bg: '#FFF8EE', text: '#3B1F0B', buttonBg: '#C2410C', buttonText: '#FFFFFF', accent: '#FDBA74', headingFont: 'playfair', radius: 'rounded', tagline: 'Cooked by 3 lakh+ home chefs' }),
    blocks: [main('Get my 30-recipe ebook', '📖', '₹199 · Instant download'), link('This week’s meal plan', '🗓️'), link('My kitchen essentials', '🍳'), video('Latest recipe'), lead('A new recipe every Sunday', '', 'Send me recipes')],
  },
  {
    id: 'cloud-kitchen', name: 'Cloud Kitchen', category: 'Food', blurb: 'A photo menu for food businesses.',
    sampleName: 'The Tiffin Co.', bio: 'Home-style meals delivered across Pune.', avatar: P.salad,
    theme: theme({ bg: '#FEF3C7', text: '#422006', buttonBg: '#B45309', buttonText: '#FFFFFF', accent: '#F59E0B', radius: 'rounded', headingFont: 'bricolage', tagline: '⭐ 4.8 on Zomato' }),
    blocks: [wa('Order on WhatsApp'), tile('Thalis', P.food, 'From ₹149'), tile('Salads', P.salad, 'From ₹129'), tile('Pizza', P.pizza, 'From ₹199'), tile('Healthy bowls', P.healthy, 'From ₹169'), link('Monthly tiffin plan', '🍱', 'Save 20%')],
  },

  // ---- Travel ----
  {
    id: 'wanderlust', name: 'Wanderlust', category: 'Travel', blurb: 'Full-photo adventure page.',
    sampleName: 'Dev on the Road', bio: 'Budget travel across India. 27 states and counting.', avatar: P.man2,
    theme: theme({ layout: 'hero', cover: img(P.lake, 1000), bg: '#0C2A3A', text: '#FFFFFF', buttonBg: '#FFFFFF', buttonText: '#0C2A3A', accent: '#7DD3FC', font: 'outfit', headingFont: 'outfit', tagline: '27 states · 14 countries' }),
    blocks: [main('Join my next group trip', '🏔️', 'Spiti · 12 seats left'), link('Free Ladakh itinerary', '🗺️'), link('My travel gear list', '🎒'), link('Book a trip-planning call', '📞', '₹399'), wa('Ask me about any place')],
  },
  {
    id: 'trip-notes', name: 'Trip Notes', category: 'Travel', blurb: 'Compact, side-by-side profile with guides.',
    sampleName: 'Maya Travels', bio: 'Solo female travel guides.', avatar: P.portrait,
    theme: theme({ layout: 'left', bg: '#E0F2FE', text: '#0C2A3A', buttonBg: '#0369A1', buttonText: '#FFFFFF', accent: '#7DD3FC', radius: 'rounded', tagline: 'Solo in 40+ cities' }),
    blocks: [main('Get the solo safety guide', '🧭', 'Free PDF'), photo(P.india, 'Taj Mahal at sunrise'), link('Rajasthan in 7 days', '🏜️'), link('Kerala in 5 days', '🌴'), lead('New guides every month', '', 'Keep me posted')],
  },

  // ---- Education ----
  {
    id: 'study-room', name: 'Study Room', category: 'Education', blurb: 'Built around your next live class.',
    sampleName: 'Prof. Arora', bio: 'Helping students crack CAT without expensive coaching.', avatar: P.man,
    theme: theme({ layout: 'left', bg: '#EEF2FF', text: '#1E1B4B', buttonBg: '#4338CA', buttonText: '#FFFFFF', accent: '#A5B4FC', radius: 'rounded', tagline: '12,000+ students taught' }),
    blocks: [webinar('Free CAT strategy masterclass', 'Plan your last 90 days.', 'Register free'), main('Download the formula book', '📐', 'Free PDF'), link('Book a doubt session', '🎓', '₹299 · 30 minutes'), reviews('Student results', [['Scored 98.7 percentile.', 'Rahul', 'CAT 2025']])],
  },
  {
    id: 'skill-school', name: 'Skill School', category: 'Education', blurb: 'Photo banner for teachers selling resources.',
    sampleName: 'Learn with Kavya', bio: 'Spoken English made easy.', avatar: P.woman,
    theme: theme({ layout: 'banner', cover: img(P.books, 1000), bg: '#FFFBEB', text: '#292524', buttonBg: '#292524', buttonText: '#FFFFFF', accent: '#FCD34D', radius: 'rounded', tagline: '1 lakh+ learners' }),
    blocks: [main('Start the 30-day English challenge', '🗣️', 'Free for everyone'), link('Interview English workbook', '📗', '₹149'), link('Live speaking batch', '🎤', 'Starts next month'), faq('Questions', [['Is this for beginners?', 'Yes, we start from the basics.']]), wa('Join the WhatsApp group')],
  },

  // ---- Business ----
  {
    id: 'money-smart', name: 'Money Smart', category: 'Business', blurb: 'Big type, serious numbers for finance creators.',
    sampleName: 'Rahul Finance', bio: 'SEBI-aware personal finance for salaried Indians.', avatar: P.man2,
    theme: theme({ layout: 'poster', bg: '#052E16', text: '#ECFDF5', buttonBg: '#D5F05C', buttonText: '#052E16', accent: '#D5F05C', font: 'space', headingFont: 'space', radius: 'rounded', tagline: '4.5L subscribers' }),
    blocks: [main('Get my free budget sheet', '📊', 'Google Sheet + guide'), webinar('Tax-saving live session', 'Old vs new regime, explained.', 'Save my seat'), link('Books I recommend', '📚'), text('Educational content, not investment advice.')],
  },
  {
    id: 'coach-pro', name: 'Coach Pro', category: 'Business', blurb: 'Calm and credible, for coaches and consultants.',
    sampleName: 'Nisha Verma', bio: 'Career coach for women returning to work.', avatar: P.portrait,
    theme: theme({ layout: 'left', bg: '#FAF5FF', text: '#3B0764', buttonBg: '#7E22CE', buttonText: '#FFFFFF', accent: '#D8B4FE', headingFont: 'playfair', radius: 'rounded', tagline: '600+ women coached' }),
    blocks: [main('Book a free 15-minute call', '📅', 'See if we’re a fit'), reviews('Client stories', [['Back at work in 3 months after a 5-year break.', 'Swati', 'Client']]), link('Free resume checklist', '📝')],
    pages: [
      { slug: 'about', title: 'About me', blocks: [text('For 12 years I hired people at large companies. Now I help women get back into great roles with confidence.', 'left'), photo(P.team, 'Workshop with clients')] },
      { slug: 'services', title: 'Services', blocks: [link('Career clarity session', '🧭', '₹1,499 · 60 minutes'), link('Resume + LinkedIn rewrite', '📄', '₹2,999'), link('8-week comeback programme', '🚀', '₹14,999'), faq('Questions', [['Do you guarantee a job?', 'No one honest can. We guarantee a clear plan and strong materials.']])] },
    ],
  },
  {
    id: 'studio-site', name: 'Studio Site', category: 'Art & Photo', blurb: 'Big type, for designers and studios.',
    sampleName: 'Kiran Studio', bio: 'Brand design for small Indian businesses.', avatar: P.art,
    theme: theme({ layout: 'poster', bg: '#F2F1EC', text: '#15161A', buttonBg: '#15161A', buttonText: '#FFFFFF', accent: '#D5F05C', font: 'dm', headingFont: 'bricolage', tagline: '150+ brands designed' }),
    blocks: [main('Start a project', '✏️', 'Reply within 24 hours'), photo(P.art, 'Recent work'), link('See my work', '🖼️'), link('Free logo checklist', '✅')],
    pages: [
      { slug: 'work', title: 'Work', blocks: [photo(P.craft, 'Packaging project'), photo(P.art, 'Brand identity'), text('Identity, packaging and social templates.')] },
      { slug: 'shop', title: 'Shop', blocks: [link('Canva social kit', '🎨', '₹799'), link('Brand starter pack', '📦', '₹1,499'), tip('Like my free resources?', 'Buy me a chai.')] },
      { slug: 'contact', title: 'Contact', blocks: [wa('Message me on WhatsApp'), brands('Project enquiry', 'Tell me about your brand.')] },
    ],
  },
  {
    id: 'webinar-hub', name: 'Webinar Hub', category: 'Education', blurb: 'For teachers who run live sessions.',
    sampleName: 'Sameer Academy', bio: 'Practical digital marketing, taught live.', avatar: P.man,
    theme: theme({ layout: 'card', cardBg: '#FFFFFF', bg: '#1E3A8A', bgType: 'gradient', bg2: '#15161A', text: '#15161A', buttonBg: '#1D4ED8', buttonText: '#FFFFFF', accent: '#93C5FD', radius: 'rounded', tagline: '200+ live sessions' }),
    blocks: [webinar('Instagram growth live workshop', 'Two hours. Real accounts reviewed live.', 'Register now'), main('Get the free content calendar', '🗓️', 'Notion + PDF'), wa('Join the community')],
    pages: [
      { slug: 'resources', title: 'Resources', blocks: [link('Reels hook swipe file', '🪝', 'Free'), link('Ads budget calculator', '🧮', 'Free'), link('Client proposal template', '📑', '₹499')] },
      { slug: 'reviews', title: 'Reviews', blocks: [reviews('Students say', [['My first client came within 3 weeks.', 'Farah', 'Freelancer'], ['Clear, no fluff, very practical.', 'Harsh', 'Founder']])] },
    ],
  },

  // ---- Tech & Gaming ----
  {
    id: 'dev-terminal', name: 'Dev Terminal', category: 'Tech & Gaming', blurb: 'Monospace, dark, made for developers.',
    sampleName: 'Aarav.codes', bio: 'Teaching DSA and system design in Hinglish.', avatar: P.man2,
    theme: theme({ layout: 'left', bg: '#0D1117', text: '#E6EDF3', buttonBg: '#238636', buttonText: '#FFFFFF', accent: '#3FB950', font: 'space', headingFont: 'space', radius: 'square', tagline: '180K devs subscribed' }),
    blocks: [main('Get the DSA roadmap', '🧑‍💻', 'Free · 180 problems'), link('Resume review', '📄', '₹799'), link('Mock interview', '🎯', '₹1,499 · 45 minutes'), video('Latest system design video'), link('My desk setup', '⌨️')],
  },
  {
    id: 'player-one', name: 'Player One', category: 'Tech & Gaming', blurb: 'Neon grid for streamers and gamers.',
    sampleName: 'ShadowPlays', bio: 'BGMI and Valorant streams, 8 PM IST.', avatar: P.gaming,
    theme: theme({ bg: '#1E0A3C', bgType: 'gradient', bg2: '#0B0118', text: '#FFFFFF', buttonBg: '#A855F7', buttonText: '#FFFFFF', accent: '#22D3EE', font: 'space', headingFont: 'space', radius: 'rounded', tagline: 'Live daily at 8 PM' }),
    blocks: [main('Watch me live now', '🔴', 'Today 8 PM IST'), tile('My setup', P.gaming, 'Gear list'), tile('Highlights', P.code, 'Best clips'), tile('Discord', P.dev, 'Join the squad'), tile('Merch', P.store, 'New drop'), tip('Support the stream', 'Every tip keeps me live.')],
  },

  // ---- Entertainment ----
  {
    id: 'laugh-track', name: 'Laugh Track', category: 'Entertainment', blurb: 'Loud and playful for comedians.',
    sampleName: 'Bunty Bol', bio: 'Stand-up, sketches and bad decisions.', avatar: P.man,
    theme: theme({ layout: 'poster', bg: '#D5F05C', text: '#15161A', buttonBg: '#15161A', buttonText: '#D5F05C', accent: '#15161A', font: 'space', headingFont: 'space', buttonStyle: 'shadow', radius: 'rounded', tagline: 'Sold out in 6 cities' }),
    blocks: [main('Book tickets for my next show', '🎟️', 'Delhi · Mumbai · Pune'), video('Latest sketch'), link('Book me for your event', '🎤'), tip('Enjoyed it?', 'Buy me a samosa.')],
  },
  {
    id: 'stage-lights', name: 'Stage Lights', category: 'Entertainment', blurb: 'Concert photo and music player.',
    sampleName: 'Aanya Sings', bio: 'Indie singer-songwriter from Shillong.', avatar: P.woman,
    theme: theme({ layout: 'hero', cover: img(P.concert, 1000), bg: '#18080F', text: '#FFFFFF', buttonBg: '#F43F5E', buttonText: '#FFFFFF', accent: '#FDA4AF', font: 'outfit', headingFont: 'outfit', tagline: '1M+ streams' }),
    blocks: [main('Listen to my new single', '🎵', 'Out now everywhere'), spotify(), link('Tour dates', '🗓️'), brands('Book me', 'Weddings, colleges and corporate events.')],
  },
  {
    id: 'dance-studio', name: 'Dance Studio', category: 'Entertainment', blurb: 'Warm gradient and class bookings.',
    sampleName: 'Rhea Moves', bio: 'Bollywood and contemporary classes for all levels.', avatar: P.dance,
    theme: theme({ layout: 'banner', cover: img(P.dance, 1000), bg: '#FFB88C', bgType: 'gradient', bg2: '#DE6262', text: '#FFFFFF', buttonBg: '#FFFFFF', buttonText: '#7A2E2E', accent: '#FFE29A', font: 'poppins', headingFont: 'poppins', tagline: '5,000+ students danced' }),
    blocks: [main('Join this weekend’s workshop', '💃', 'Online · ₹299'), link('Wedding sangeet choreography', '💍'), video('Latest routine'), wa('Enquire on WhatsApp')],
  },
  {
    id: 'on-air', name: 'On Air', category: 'Entertainment', blurb: 'Episode-first page for podcasters.',
    sampleName: 'The Chai Podcast', bio: 'Honest conversations with India’s builders.', avatar: P.mic,
    theme: theme({ layout: 'banner', cover: img(P.mic, 1000), bg: '#1C1917', text: '#FAFAF9', buttonBg: '#F59E0B', buttonText: '#1C1917', accent: '#F59E0B', headingFont: 'bricolage', radius: 'rounded', tagline: 'Top 50 in Business, India' }),
    blocks: [main('Play the latest episode', '🎙️', 'New every Tuesday'), spotify(), link('Be a guest', '🪑'), brands('Sponsor the show', 'Reach 80K monthly listeners.')],
  },

  // ---- Art & Photo ----
  {
    id: 'frame-gallery', name: 'Frame Gallery', category: 'Art & Photo', blurb: 'Lets your photographs do the talking.',
    sampleName: 'Lens by Arjun', bio: 'Wedding and portrait photographer, Jaipur.', avatar: P.camera,
    theme: theme({ layout: 'hero', cover: img(P.camera, 1000), bg: '#0A0A0A', text: '#FAFAFA', buttonBg: '#FAFAFA', buttonText: '#0A0A0A', accent: '#A3A3A3', headingFont: 'playfair', radius: 'square', tagline: '300+ weddings shot' }),
    blocks: [main('Check my availability', '📷', 'Booking for next season'), photo(P.portrait, 'Portrait work'), photo(P.india, 'Travel work'), link('Lightroom preset pack', '🎞️', '₹599'), wa('Enquire on WhatsApp')],
  },
  {
    id: 'art-studio', name: 'Art Studio', category: 'Art & Photo', blurb: 'A colourful shop grid for artists.',
    sampleName: 'Paint with Zoya', bio: 'Original art, prints and commissions.', avatar: P.craft,
    theme: theme({ bg: '#FEF9C3', text: '#1F2937', buttonBg: '#DB2777', buttonText: '#FFFFFF', accent: '#F9A8D4', radius: 'rounded', headingFont: 'playfair', tagline: 'Shipped to 22 countries' }),
    blocks: [main('Commission a painting', '🎨', 'Slots open this month'), tile('Original art', P.art, 'One of a kind'), tile('Prints', P.craft, 'From ₹499'), tile('Workshops', P.team, 'Online'), tile('Sketchbook', P.books, 'Behind the scenes'), tip('Support my art', '')],
  },

  // ---- Hindi ----
  {
    id: 'ghar-ka-khana', name: 'घर का खाना', category: 'Hindi', language: 'hi', blurb: 'हिंदी में रेसिपी पेज।',
    sampleName: 'सीमा की रसोई', bio: 'रोज़ की आसान और स्वादिष्ट रेसिपी।', avatar: P.woman,
    theme: theme({ layout: 'banner', cover: img(P.food, 1000), bg: '#FFF7ED', text: '#431407', buttonBg: '#C2410C', buttonText: '#FFFFFF', accent: '#FDBA74', font: 'mukta', headingFont: 'mukta', radius: 'rounded', tagline: '5 लाख+ परिवारों का भरोसा' }),
    blocks: [main('मेरी 50 रेसिपी की किताब पाएं', '📖', 'सिर्फ़ ₹149'), link('इस हफ़्ते का मेन्यू', '🗓️'), video('नई रेसिपी देखें'), wa('WhatsApp पर जुड़ें')],
  },
  {
    id: 'exam-guru', name: 'परीक्षा गुरु', category: 'Hindi', language: 'hi', blurb: 'शिक्षकों और कोचिंग के लिए।',
    sampleName: 'अमित सर', bio: 'UPSC और SSC की तैयारी, सरल हिंदी में।', avatar: P.man,
    theme: theme({ layout: 'left', bg: '#EFF6FF', text: '#172554', buttonBg: '#1D4ED8', buttonText: '#FFFFFF', accent: '#93C5FD', font: 'mukta', headingFont: 'mukta', radius: 'rounded', tagline: '2 लाख+ छात्र' }),
    blocks: [webinar('मुफ़्त लाइव क्लास', 'पहले प्रयास में सफलता की रणनीति।', 'अभी रजिस्टर करें'), main('मुफ़्त नोट्स डाउनलोड करें', '📚', 'PDF'), wa('छात्र WhatsApp ग्रुप'), faq('सवाल', [['क्या यह शुरुआती छात्रों के लिए है?', 'हाँ, हम बिल्कुल शुरुआत से पढ़ाते हैं।']])],
  },
  {
    id: 'maa-ki-diary', name: 'माँ की डायरी', category: 'Hindi', language: 'hi', blurb: 'पेरेंटिंग के लिए प्यारा कार्ड पेज।',
    sampleName: 'रश्मि', bio: 'बच्चों की परवरिश के सच्चे अनुभव।', avatar: P.family,
    theme: theme({ layout: 'card', cardBg: '#FFFFFF', bg: '#FCE7F3', bgType: 'gradient', bg2: '#FBCFE8', text: '#500724', buttonBg: '#BE185D', buttonText: '#FFFFFF', accent: '#F9A8D4', font: 'mukta', headingFont: 'mukta', radius: 'rounded', tagline: '1 लाख+ माता-पिता' }),
    blocks: [main('बच्चों का डाइट चार्ट पाएं', '🍎', 'मुफ़्त PDF'), link('स्क्रीन टाइम गाइड', '📱'), wa('माताओं के ग्रुप से जुड़ें'), lead('हर रविवार एक नई सीख', '', 'मुझे भेजें')],
  },
  {
    id: 'shanti', name: 'शांति', category: 'Hindi', language: 'hi', blurb: 'आध्यात्म और ध्यान के लिए शांत पेज।',
    sampleName: 'स्वामी आनंद', bio: 'रोज़ का ध्यान और भजन।', avatar: P.yoga,
    theme: theme({ layout: 'hero', cover: img(P.yoga, 1000), bg: '#7C2D12', text: '#FFF7ED', buttonBg: '#FDBA74', buttonText: '#431407', accent: '#FDBA74', font: 'mukta', headingFont: 'mukta', tagline: 'हर सुबह 6 बजे लाइव' }),
    blocks: [main('आज का ध्यान शुरू करें', '🕉️', '10 मिनट'), spotify(), link('भजन संग्रह', '🎶'), tip('सेवा में सहयोग करें', '')],
  },
]

// ---- what each kind of creator would sell and say ----
// Used as examples in previews. Sample products never appear on the public site.
const KITS = {
  Creator: {
    digital: ['My content planner', 299, P.books], session: ['30-minute creator call', 999, P.team], webinar: 'Grow your first 10K followers', affiliate: ['The camera I use', 18999, P.camera, 'Amazon'],
    video: 'My latest video', lead: 'Get my weekly letter', leadText: 'One useful email every Sunday.', photos: [P.camera, P.team, P.mic, P.store],
    reviews: [['Clear, honest and actually useful.', 'Priya', 'Follower'], ['Every call gave me something to act on.', 'Arjun', 'Client']], faq: [['Do you reply to messages?', 'Yes, usually within two days.']],
  },
  'Fashion & Beauty': {
    digital: ['Capsule wardrobe guide', 249, P.fashion], session: ['Personal styling call', 799, P.model], webinar: 'Build a wardrobe that works', affiliate: ['Everyday tote bag', 1499, P.store, 'Myntra'],
    video: 'Get ready with me', lead: 'New looks every week', leadText: 'My best finds, once a week.', photos: [P.fashion, P.model, P.store, P.portrait],
    reviews: [['I finally know what suits me.', 'Nidhi', 'Client'], ['Every recommendation was worth it.', 'Sneha', 'Follower']], faq: [['Do you only suggest expensive brands?', 'No. Most picks are affordable and easy to find.']],
  },
  'Fitness & Wellness': {
    digital: ['12-week home workout plan', 499, P.workout], session: ['1:1 fitness consultation', 999, P.gym], webinar: 'Live: fix your diet in 7 days', affiliate: ['Resistance band set', 899, P.lift, 'Amazon'],
    video: 'Follow-along workout', lead: 'Free weekly workout', leadText: 'One new routine every Monday.', photos: [P.gym, P.workout, P.yoga, P.healthy],
    reviews: [['Stayed consistent for the first time.', 'Pooja', 'Client'], ['Simple plans I could really follow.', 'Amit', 'Client']], faq: [['Do I need a gym?', 'No. Every plan has a home version.']],
  },
  Food: {
    digital: ['30 easy recipes ebook', 199, P.food], session: ['Plan your kitchen: 1:1 call', 599, P.salad], webinar: 'Live cook-along: 3 quick dinners', affiliate: ['My favourite kadhai', 1299, P.pizza, 'Amazon'],
    video: 'Latest recipe', lead: 'A new recipe every Sunday', leadText: 'Quick, tested and family-friendly.', photos: [P.food, P.salad, P.pizza, P.healthy],
    reviews: [['My family asks for these every week.', 'Kavita', 'Home cook'], ['Really takes 20 minutes.', 'Rohit', 'Reader']], faq: [['Are the recipes vegetarian?', 'Most are, with clear swaps for the rest.']],
  },
  Travel: {
    digital: ['Ladakh itinerary guide', 299, P.lake], session: ['Trip-planning call', 499, P.travel], webinar: 'Live: plan a budget trip', affiliate: ['My travel backpack', 3499, P.india, 'Amazon'],
    video: 'Latest trip film', lead: 'New trip guides monthly', leadText: 'Routes, costs and stays that worked.', photos: [P.lake, P.travel, P.india, P.camera],
    reviews: [['Saved me days of planning.', 'Farah', 'Traveller'], ['Every stay was exactly as described.', 'Nikhil', 'Traveller']], faq: [['Are the costs up to date?', 'I update each guide after every trip.']],
  },
  Education: {
    digital: ['Complete study notes', 199, P.books], session: ['Doubt-solving session', 299, P.school], webinar: 'Free strategy masterclass', affiliate: ['Books I recommend', 599, P.school, 'Flipkart'],
    video: 'Latest free lesson', lead: 'Free study tips weekly', leadText: 'One practical tip every week.', photos: [P.books, P.school, P.team, P.dev],
    reviews: [['My scores improved within a month.', 'Rahul', 'Student'], ['Explains hard topics simply.', 'Divya', 'Student']], faq: [['Is this for beginners?', 'Yes, we start from the basics.']],
  },
  Business: {
    digital: ['Budget and planning sheet', 299, P.finance], session: ['1:1 strategy session', 1499, P.team], webinar: 'Live: plan your next year', affiliate: ['Books that helped me', 499, P.books, 'Amazon'],
    video: 'Latest explainer', lead: 'One clear idea a week', leadText: 'Short, practical and free.', photos: [P.finance, P.team, P.books, P.dev],
    reviews: [['I left with a clear plan.', 'Swati', 'Client'], ['Practical advice, no jargon.', 'Harsh', 'Founder']], faq: [['Who is this for?', 'Working professionals and small business owners.']],
  },
  'Tech & Gaming': {
    digital: ['Complete roadmap PDF', 199, P.code], session: ['Mock interview or review', 799, P.dev], webinar: 'Live: build a project with me', affiliate: ['My desk setup keyboard', 4499, P.gaming, 'Amazon'],
    video: 'Latest video', lead: 'New drops in your inbox', leadText: 'New guides and streams, nothing else.', photos: [P.code, P.dev, P.gaming, P.team],
    reviews: [['Helped me crack my interview.', 'Sahil', 'Viewer'], ['Best explanation I have found.', 'Ritu', 'Viewer']], faq: [['Is the content in Hindi?', 'Mostly Hinglish, with English notes.']],
  },
  Entertainment: {
    digital: ['Behind-the-scenes pack', 149, P.studio], session: ['Personal video call', 999, P.mic], webinar: 'Live show online', affiliate: ['My favourite headphones', 2999, P.concert, 'Amazon'],
    video: 'Latest performance', lead: 'Know about shows first', leadText: 'Dates and drops before anyone else.', photos: [P.concert, P.studio, P.dance, P.mic],
    reviews: [['An unforgettable show.', 'Tanya', 'Fan'], ['Our event was a huge hit.', 'Neeraj', 'Organiser']], faq: [['Do you travel for events?', 'Yes, across India. Send the details below.']],
  },
  'Art & Photo': {
    digital: ['Preset or print pack', 599, P.art], session: ['Portfolio review', 799, P.camera], webinar: 'Live creative workshop', affiliate: ['The tools I use', 1999, P.craft, 'Amazon'],
    video: 'Behind the work', lead: 'New work every month', leadText: 'See new pieces before anyone else.', photos: [P.art, P.craft, P.camera, P.portrait],
    reviews: [['Better than we imagined.', 'Aditi', 'Client'], ['Beautiful work, delivered on time.', 'Karan', 'Client']], faq: [['Do you take custom work?', 'Yes. Send your idea through the form below.']],
  },
  Hindi: {
    digital: ['मेरी पूरी गाइड (PDF)', 149, P.books], session: ['1:1 बातचीत', 499, P.team], webinar: 'मुफ़्त लाइव क्लास', affiliate: ['मेरी पसंदीदा चीज़', 799, P.store, 'Amazon'],
    video: 'नया वीडियो देखें', lead: 'हर हफ़्ते नई जानकारी', leadText: 'सीधे आपके पास, बिल्कुल मुफ़्त।', photos: [P.books, P.food, P.family, P.yoga],
    reviews: [['बहुत आसान और काम की जानकारी।', 'सुनीता', 'पाठक'], ['हर बात साफ़ समझ में आई।', 'रमेश', 'छात्र']], faq: [['क्या यह शुरुआत करने वालों के लिए है?', 'हाँ, सब कुछ शुरू से समझाया गया है।']],
  },
}

const WORDS = {
  en: {
    shop: 'Shop', content: 'Content', work: 'Work with me', shopTitle: 'My products', reviews: 'What people say', faq: 'Questions', subscribe: 'Keep me posted',
    coffee: 'Buy me a coffee', coffeeText: 'Enjoying my work? Support it with a small amount.', brand: 'Work with me', brandText: 'For brands and collaborations.', timer: 'Next live starts in', remind: 'Save my seat',
    about: 'About me', aboutText: 'Tell people who you are, what you do and why they should trust you.', watch: 'Watch', watchText: 'Your newest video', reviewCard: 'Reviews', faqCard: 'Questions',
  },
  hi: {
    shop: 'दुकान', content: 'कंटेंट', work: 'साथ काम करें', shopTitle: 'मेरे प्रोडक्ट', reviews: 'लोग क्या कहते हैं', faq: 'सवाल', subscribe: 'मुझे भेजें',
    coffee: 'मुझे कॉफ़ी पिलाएँ', coffeeText: 'मेरा काम पसंद आया? थोड़ा सहयोग करें।', brand: 'साथ काम करें', brandText: 'ब्रांड और सहयोग के लिए।', timer: 'अगला लाइव शुरू होगा', remind: 'मेरी जगह पक्की करें',
    about: 'मेरे बारे में', aboutText: 'बताएं कि आप कौन हैं और क्या करते हैं।', watch: 'देखें', watchText: 'आपका नया वीडियो', reviewCard: 'समीक्षाएँ', faqCard: 'सवाल',
  },
}

/** Example products shown in previews until the creator publishes their own */
function sampleProducts(k, t, ownWebinar) {
  const pic = (id) => img(id, 600)
  const base = (id, type, title, price, photo, data, description) => ({ id: `sample-${id}`, type, title, description, price_inr: price, compare_at_inr: null, thumbnail_url: pic(photo), show_on_page: true, stock_left: null, sales_count: 0, data })
  const hi = t.language === 'hi'
  return [
    base('digital', 'digital', k.digital[0], k.digital[1], k.digital[2], {}, hi ? 'खरीदते ही डाउनलोड करें।' : 'Instant download after payment.'),
    base('session', 'session', k.session[0], k.session[1], k.session[2], { duration: 30, buffer: 10, advance_days: 14, sessions: 1, reschedule_hours: 24, availability: [{ day: 1, start: '18:00', end: '21:00' }, { day: 3, start: '18:00', end: '21:00' }, { day: 6, start: '11:00', end: '14:00' }] }, hi ? 'अपना समय चुनें और वीडियो कॉल पर मिलें।' : 'Pick a time and meet on a video call.'),
    base('webinar', 'webinar', ownWebinar?.data.title || k.webinar, 0, k.photos[1], { starts_at: new Date(Date.now() + 14 * 86400000).toISOString(), duration: 60, capacity: '' }, ownWebinar?.data.description || (hi ? 'लाइव जुड़ें और सवाल पूछें।' : 'Join live and ask your questions.')),
    base('affiliate', 'link', k.affiliate[0], k.affiliate[1], k.affiliate[2], { url: SAMPLE_URL, label: k.affiliate[3] }),
  ]
}

/** Every template is a small site with a top menu: Home, Shop, Content, Work with me */
function compose(t) {
  const hi = t.language === 'hi'
  const L = WORDS[hi ? 'hi' : 'en']
  const k = KITS[hi ? 'Hindi' : t.category]
  const own = (type) => t.blocks.find((b) => b.type === type)
  const primary = t.blocks.find((b) => b.type === 'link' && b.data.primary)
  const chat = own('whatsapp')
  const note = own('text')
  const photos = t.blocks.filter((b) => b.type === 'image')
  const media = own('spotify') || own('youtube') || video(k.video)
  const trust = own('testimonials') || reviews(L.reviews, k.reviews)
  const answers = own('faq') || faq(L.faq, k.faq)
  const form = own('lead_form') || lead(k.lead, k.leadText, L.subscribe)
  const coffee = own('tip') || tip(L.coffee, L.coffeeText)
  const brand = own('enquiry') || brands(L.brand, L.brandText)
  const timer = own('countdown') || countdown(L.timer, L.remind)
  const tiles = t.blocks.filter((b) => b.type === 'link' && b.data.thumbnail)
  const shop = { type: 'products', data: { title: L.shopTitle, ...t.sections.products, limit: 0, sample: true, sample_products: sampleProducts(k, t, own('webinar')) } }
  const clean = (list) => list.filter(Boolean)

  t.structure = 'tabs'
  t.blocks = clean([primary, ...tiles, trust, form, note, chat])
  t.pages = [
    { slug: 'shop', title: L.shop, blocks: [shop, coffee] },
    { slug: 'content', title: L.content, blocks: clean([media, ...photos, timer, answers]) },
    { slug: 'work', title: L.work, blocks: [brand] },
  ]
}

// How each design lays out its cards. Unlisted designs use 2 in a row with the picture on top
const SECTION_LOOKS = {
  list: { ids: ['essentials', 'vogue-edit', 'nourish', 'skill-school', 'money-smart', 'coach-pro', 'studio-site', 'webinar-hub', 'dev-terminal', 'on-air', 'exam-guru', 'shanti'], look: { columns: 1, style: 'row' } },
  tiles: { ids: ['bento', 'street-drop', 'skin-diary', 'cloud-kitchen', 'trip-notes', 'player-one', 'laugh-track', 'dance-studio', 'frame-gallery', 'art-studio', 'maa-ki-diary'], look: { columns: 2, style: 'overlay' } },
  swipe: { ids: ['spotlight', 'iron-mode', 'wanderlust', 'kitchen-stories', 'stage-lights', 'launch-drop', 'rose-glow', 'yoga-flow'], look: { columns: 'swipe', style: 'image' } },
}
const sectionLook = (id) => Object.values(SECTION_LOOKS).find((g) => g.ids.includes(id))?.look || { columns: 2, style: 'image' }

for (const t of TEMPLATES) {
  delete t.pages
  const look = sectionLook(t.id)
  t.sections = { products: look, cards: look }
  compose(t)
}

/** Section types whose card layout follows the design */
export const RESTYLED_TYPES = ['products', 'cards']

/** A block laid out the way a design lays out its cards. Its content never changes */
export function restyle(block, template) {
  const look = template.sections?.[block.type]
  return look ? { ...block, data: { ...block.data, columns: look.columns, style: look.style } } : block
}

/** A design's theme for a page, keeping the creator's own cover photo and trust line */
export function lookFor(template, oldTheme = {}) {
  const ownCover = oldTheme.cover && !oldTheme.cover.includes('images.unsplash.com') ? oldTheme.cover : undefined
  return { ...template.theme, tagline: oldTheme.tagline || '', structure: oldTheme.structure, template: template.id, ...(ownCover ? { cover: ownCover } : {}) }
}

/** True when the creator has made something of their own, so previews should show their real site */
export const hasOwnContent = (blocks = []) => blocks.some((b) => !b.data?.sample && b.type !== 'products')

/** The creator's real site, page by page, as it would look in a design */
export function sitePreview(template, page, slug, { blocks = [], sitePages = [] }) {
  const sub = slug ? sitePages.find((s) => s.slug === slug) : null
  const shown = (b) => b.is_active !== false && (!b.data?.sample || b.type === 'products')
  return {
    page: { ...page, theme: lookFor(template, page.theme) },
    blocks: blocks.filter((b) => (b.site_page_id ?? null) === (sub?.id ?? null) && shown(b)).map((b) => restyle(b, template)),
    nav: sitePages.filter((s) => s.is_published !== false && s.show_in_nav !== false && blocks.some((b) => b.site_page_id === s.id && shown(b))).map((s) => ({ slug: s.slug, label: s.nav_label || s.title })),
    sitePage: sub ? { slug: sub.slug, title: sub.title } : null,
  }
}

const CONTENT_SLOTS = ['youtube', 'instagram', 'latest_reel', 'spotify', 'testimonials', 'faq', 'countdown']

/**
 * Fits a template around what the creator already made in their dashboard. Their sections take
 * the matching places in the template, the rest are added where they belong, and anything left
 * stays a sample that only the creator can see.
 */
export function shapeTemplate(template, existing = []) {
  const pool = existing.filter((b) => !b.data?.sample && b.type !== 'products')
  const take = (slot) => {
    const i = pool.findIndex((b) => b.type === slot.type && (b.type !== 'link' || Boolean(b.data.primary) === Boolean(slot.data.primary)))
    if (i < 0) return slot
    const [own] = pool.splice(i, 1)
    return { ...slot, data: own.data, is_active: own.is_active, starts_at: own.starts_at, ends_at: own.ends_at }
  }
  const home = template.blocks.map(take)
  const pages = (template.pages || []).map((p) => ({ ...p, blocks: p.blocks.map(take) }))
  for (const b of pool) {
    const own = { type: b.type, data: b.data, is_active: b.is_active, starts_at: b.starts_at, ends_at: b.ends_at }
    const slug = b.type === 'tip' ? 'shop' : CONTENT_SLOTS.includes(b.type) ? 'content' : null
    ;(pages.find((p) => p.slug === slug)?.blocks || home).push(own)
  }
  return { blocks: home, pages }
}

/** Blocks with stable ids for previews */
function withIds(templateId, blocks, prefix) {
  return blocks.map((b, i) => ({ ...b, id: `${templateId}-${prefix}-${i}` }))
}

/** Page-shaped data the phone preview can render, using the creator's own details when present */
export function templatePreview(original, page = {}, slug = null, existing = []) {
  const template = shapeTemplate(original, existing)
  const id = original.id
  const sub = slug ? template.pages.find((p) => p.slug === slug) : null
  return {
    page: {
      id: 'preview',
      username: page.username || 'yourname',
      display_name: page.display_name || original.sampleName,
      bio: page.bio || original.bio,
      avatar_url: page.avatar_url || (original.avatar ? img(original.avatar, 240) : null),
      language: original.language || 'en',
      theme: original.theme,
      socials: { instagram: 'yourname', youtube: 'yourname' },
      show_branding: true,
    },
    blocks: withIds(id, (sub ? sub.blocks : template.blocks).filter((b) => b.is_active !== false), slug || 'home'),
    nav: template.pages.map((p) => ({ slug: p.slug, label: p.title })),
    sitePage: sub ? { slug: sub.slug, title: sub.title } : null,
  }
}
