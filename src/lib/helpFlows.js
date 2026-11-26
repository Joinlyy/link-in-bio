// Short step-by-step help for every dashboard page, shown in the side Help guide.
// A flow is a few steps in order: [title, optional small hint]. Keep every line short.

const CONNECT_UPI = ['Add your payout UPI ID', 'Settings, Payouts. Paid products need it.']

export const FLOWS = {
  '/dashboard': {
    title: 'Start here',
    intro: 'Your home base. These are the first five steps, and below is where everything lives.',
    flows: [
      { name: 'First 5 minutes', steps: [['Add your details', 'Website: name, photo, about'], ['Add something to sell or share', 'Products, or links in Website'], ['Turn on Live', 'The switch at the top'], ['Copy your link', 'Overview, Share your link'], ['Paste it in your bio', 'Instagram, YouTube, WhatsApp']] },
    ],
    map: [
      ['Website', '/dashboard/editor', 'Your pages and what is on them. Design and Templates are here too.'],
      ['Products', '/dashboard/products', 'Add things to sell. Sales tab: orders, invoices and refunds.'],
      ['Content & forms', '/dashboard/content', 'Lead form, videos, Spotify, reviews, FAQ, countdown.'],
      ['Brand', '/dashboard/deals', 'Collabs, brand form, invoices and your media kit.'],
      ['Audience, Everyone and Leads', '/dashboard/audience', 'Everyone who bought or signed up.'],
      ['Audience, DM automation', '/dashboard/automations', 'Free comment to DM: auto-reply when someone comments a keyword.'],
      ['Audience, Schedule posts', '/dashboard/schedule', 'Post an image, carousel or Reel to Instagram at a time you pick.'],
      ['Analytics', '/dashboard/analytics', 'Visits, clicks and sales.'],
      ['Settings', '/dashboard/settings', 'Social links, Instagram connection and your account.'],
      ['Settings, Payouts', '/dashboard/payouts', 'Your payout UPI ID, what you earned, and tax details for invoices.'],
      ['Settings, Plan', '/dashboard/billing', 'Your plan, limits and autopay.'],
      ['Settings, Messages', '/dashboard/messages', 'Ask our team for help.'],
    ],
  },
  '/dashboard/editor': {
    title: 'Website: Pages',
    intro: 'A map of your site, top to bottom.',
    flows: [
      { name: 'Fill in your page', steps: [['Open Home'], ['Add name, photo and about'], ['Add links or sections'], ['Drag to reorder'], ['Check the preview']] },
      { name: 'Hide something', steps: [['Tap the eye icon', 'Hidden items stay saved']] },
    ],
  },
  '/dashboard/appearance': {
    title: 'Website: Design',
    intro: 'Colours, fonts and buttons for the whole site.',
    flows: [{ name: 'Change the look', steps: [['Pick a theme close to your style'], ['Change colours'], ['Check phone and desktop preview']] }],
  },
  '/dashboard/templates': {
    title: 'Website: Templates',
    intro: 'A whole new design in one tap. Your content stays.',
    flows: [{ name: 'Switch template', steps: [['Tap a design', 'You see it with your content'], ['Choose: only the look, or look and pages'], ['Apply']] }],
  },
  '/dashboard/products': {
    title: 'Products',
    intro: 'Everything you sell. Buyers pay at checkout, you get your earning in your UPI within 2 working days.',
    flows: [
      { name: 'Add a product', steps: [CONNECT_UPI, ['Tap New product'], ['Pick a type', 'Digital, session, webinar, course...'], ['Title, image, price', 'Price is final, add GST if you charge it'], ['What the buyer gets'], ['Publish']] },
    ],
  },
  '/dashboard/products/*': {
    title: 'Edit product',
    intro: 'All the details of one product.',
    flows: [
      { name: 'Finish and publish', steps: [['Write a clear title'], ['Add an image'], ['Set the price', 'You see what you receive after our charge'], ['Add what buyers get', 'File, link or message'], ['Turn on Publish']] },
    ],
  },
  '/dashboard/sales': {
    title: 'Sales',
    intro: 'Orders, bookings and what you earned.',
    flows: [
      { name: 'Handle an order', steps: [['Open Orders'], ['See who bought what'], ['Open the Invoice link', 'Print or save as PDF']] },
      { name: 'Refund a buyer', steps: [['Mark the order refunded', 'This ends their access'], ['Email support@joinlyy.com with the order', 'We send the money back']] },
    ],
  },
  '/dashboard/content': {
    title: 'Content & forms',
    intro: 'Forms, videos, music, reviews, FAQ and countdowns.',
    flows: [{ name: 'Add one', steps: [['Tap what you want'], ['Fill it in', 'It saves by itself'], ['Move it in Website, Pages']] }],
  },
  '/dashboard/deals': {
    title: 'Brand: Collabs',
    intro: 'Every brand deal, from first message to payment.',
    flows: [{ name: 'Run a deal', steps: [['Enquiry arrives from your brand form'], ['Open it and set value and dates'], ['Drag it to the next stage'], ['Payment received']] }],
  },
  '/dashboard/brand-form': {
    title: 'Brand: Brand form',
    intro: 'The form brands use to contact you.',
    flows: [{ name: 'Set it up', steps: [['Add it to your site'], ['Write what work you accept'], ['Make it live']] }],
  },
  '/dashboard/invoices': {
    title: 'Brand: Invoices',
    intro: 'Invoices for brand deals. Invoices for your own sales are in Sales.',
    flows: [{ name: 'Send an invoice', steps: [['Add business and bank details once'], ['Create an invoice', 'Or start from a deal'], ['Download it'], ['Mark paid']] }],
  },
  '/dashboard/media-kit': {
    title: 'Brand: Media kit',
    intro: 'A page that shows brands your reach.',
    flows: [{ name: 'Make yours', steps: [['Connect Instagram', 'Fills your stats'], ['Write about you'], ['Add rates and past work'], ['Share the link']] }],
  },
  '/dashboard/audience': {
    title: 'Audience',
    intro: 'Everyone who bought or signed up. Tabs: Leads, DM automation, Schedule posts.',
    flows: [{ name: 'Use your list', steps: [['Filter by source or tag'], ['Save a segment'], ['Export when needed']] }],
  },
  '/dashboard/leads': {
    title: 'Audience: Leads',
    intro: 'People who filled your lead form.',
    flows: [{ name: 'Follow up', steps: [['See new sign-ups'], ['Tag them'], ['Export or contact']] }],
  },
  '/dashboard/automations': {
    title: 'Audience: DM automation',
    intro: 'Free. Reply to comments and messages automatically.',
    flows: [
      { name: 'Comment to DM', steps: [['Connect Instagram', 'Settings, Instagram'], ['New automation'], ['Pick a keyword', 'Like GUIDE'], ['Write the message and link'], ['Save']] },
      { name: 'Test it', steps: [['Comment the keyword from another account'], ['Check the DM and Recent activity']] },
    ],
  },
  '/dashboard/schedule': {
    title: 'Audience: Schedule posts',
    intro: 'Free post scheduler. Joinlyy posts for you.',
    flows: [
      { name: 'Schedule a post', steps: [['Connect Instagram', 'Settings, Instagram'], ['Pick Image, Carousel or Reel'], ['Upload your file'], ['Write the caption'], ['Pick a time, or Post now']] },
      { name: 'Limits', steps: [['Free: 1 post a day, 15 Reels a month'], ['Creator: 3 a day, 40 Reels'], ['Pro: 3 a day, 50 Reels']] },
    ],
  },
  '/dashboard/analytics': {
    title: 'Analytics',
    intro: 'Visits, clicks and sales. Free plan shows 30 days.',
    flows: [{ name: 'Read it', steps: [['Pick a date range'], ['See which items get clicks'], ['Move the best ones higher']] }],
  },
  '/dashboard/settings': {
    title: 'Settings',
    intro: 'Your links, connections and account.',
    flows: [
      { name: 'Set up once', steps: [['Add social links'], ['Connect Instagram'], ['Add your payout UPI ID', 'In Payouts'], ['Turn on two-step login']] },
    ],
  },
  '/dashboard/team': {
    title: 'Settings: Team',
    intro: 'Let others help manage your site.',
    flows: [{ name: 'Invite someone', steps: [['Enter their email'], ['Choose a role'], ['Send the invite']] }],
  },
  '/dashboard/payouts': {
    title: 'Settings: Payouts',
    intro: 'How you get paid and what shows on invoices.',
    flows: [
      { name: 'Get paid', steps: [['Add your payout UPI ID'], ['Buyer pays at checkout'], ['Our platform charge is taken'], ['Your earning reaches your UPI in 2 working days']] },
      { name: 'Invoices for buyers', steps: [['Add business name and address'], ['Add GSTIN if you have one', 'Then invoices show GST'], ['No GSTIN: invoices show no GST']] },
    ],
  },
  '/dashboard/billing': {
    title: 'Settings: Plan',
    intro: 'Your plan and what it includes.',
    flows: [{ name: 'Upgrade', steps: [['Compare plans'], ['Press Subscribe'], ['Pay with UPI, card or net banking', 'GST is added'], ['Autopay keeps it on', 'Turn it off any time']] }],
  },
  '/dashboard/referrals': {
    title: 'Settings: Refer & earn',
    intro: 'Invite other creators.',
    flows: [{ name: 'Refer', steps: [['Copy your link'], ['Share it'], ['Track who joined']] }],
  },
  '/dashboard/messages': {
    title: 'Settings: Messages',
    intro: 'Ask our team for help.',
    flows: [{ name: 'Get help', steps: [['Say what happened'], ['Name the page you were on'], ['Check back here for a reply']] }],
  },
  '/dashboard/guide': {
    title: 'Guide',
    intro: 'The full guide, in one place.',
    flows: [{ name: 'Use it', steps: [['Read How it works'], ['Check What things mean'], ['Finish The minimum you need']] }],
  },
}

/** The help for the page being shown, or null */
export function findFlow(path) {
  const clean = path.replace(/\/+$/, '') || '/'
  if (FLOWS[clean]) return FLOWS[clean]
  if (clean.startsWith('/dashboard/products/')) return FLOWS['/dashboard/products/*']
  return null
}
