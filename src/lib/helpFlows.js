// Side Help guide for every dashboard page.
//
// Each page has:
//   purpose  one or two plain sentences: what this page is for
//   flows    named step-by-step lists. A step is { t: what to do, d: what that means in plain words, go?: [button label, link] }
//   tips     short "good to know" lines
//   stuck    [question, answer] pairs for the common problems
// The Overview page also has `map`: where everything lives, with what you can do there.

const PAYOUT = { t: 'Add your payout UPI ID', d: 'This is where we send your earnings. Paid products stay locked until it is set.', go: ['Open Payouts', '/dashboard/payouts'] }

export const FLOWS = {
  '/dashboard': {
    title: 'Welcome. Start here',
    purpose: 'This is your home page. It shows how your page is doing and what to do next. The steps below take you from nothing to a page people can open and buy from.',
    flows: [
      {
        name: 'Set up in 5 steps',
        steps: [
          { t: 'Fill in your name, photo and about', d: 'This is the first thing visitors read. A clear photo and one line about what you do is enough.', go: ['Open Website', '/dashboard/editor'] },
          { t: 'Add something to sell or share', d: 'Add a product (a PDF, a call, a course link) or just your links. You can start with one.', go: ['Open Products', '/dashboard/products'] },
          { t: 'Connect Instagram (optional)', d: 'Needed for free comment-to-DM replies, post scheduling and the media kit.', go: ['Open Settings', '/dashboard/settings'] },
          { t: 'Switch your page to Live', d: 'Use the Live switch at the top of the screen. Until it is on, only you can see your page.' },
          { t: 'Put your link in your bio', d: 'Copy your link from the top bar and paste it in your Instagram, YouTube and WhatsApp bio.' },
        ],
      },
    ],
    map: [
      ['Website', '/dashboard/editor', 'Build what visitors see', ['Edit your pages and sections', 'Change colours and fonts (Design)', 'Switch to a new look (Templates)']],
      ['Products', '/dashboard/products', 'Sell things and see orders', ['Add products, sessions, webinars, courses', 'Sales tab: orders, invoices, refunds', 'See what you earn after our charge']],
      ['Content & forms', '/dashboard/content', 'Add extras to your page', ['Email sign-up form', 'Videos, Spotify, reviews, FAQ, countdown']],
      ['Brand', '/dashboard/deals', 'Work with brands', ['Track collabs from enquiry to payment', 'Brand enquiry form', 'Invoices for brand deals', 'Media kit PDF for pitches']],
      ['Audience', '/dashboard/audience', 'Your people and Instagram tools', ['Everyone: buyers and sign-ups', 'Leads: people who joined your form', 'DM automation (free): auto-reply to comments', 'Schedule posts (free): post to Instagram later']],
      ['Analytics', '/dashboard/analytics', 'See what works', ['Visits, clicks and sales', 'Which links get the most taps', 'Free plan shows the last 30 days']],
      ['Settings', '/dashboard/settings', 'Your account and connections', ['Social links and Instagram connection', 'Payouts: your UPI ID, earnings, tax details', 'Plan and autopay', 'Team, referrals, messages to our team']],
      ['Guide', '/dashboard/guide', 'The full guide', ['What each word means', 'The minimum you need before you go live']],
    ],
    tips: ['The HELP book on the right of every page explains that page. Open it any time.', 'Everything saves by itself. You never need a Save button on the website pages.'],
    stuck: [
      ['Nobody can see my page', 'Check the Live switch at the top is on. Then open your link in a private window to see what visitors see.'],
      ['Where do I get paid?', 'Open Settings, then Payouts. Add your UPI ID. Your earnings arrive there within 2 working days of each sale.'],
    ],
  },

  '/dashboard/editor': {
    title: 'Website: Pages',
    purpose: 'A map of your whole site. Each page is a screen visitors can open, and each page is made of sections stacked from top to bottom.',
    flows: [
      {
        name: 'Fill in your home page',
        steps: [
          { t: 'Open “Home”', d: 'Home is the page people land on from your bio link.' },
          { t: 'Add your name, photo and short about', d: 'Two lines is enough. Say what you do and who it helps.' },
          { t: 'Add sections', d: 'Links, products, a sign-up form, a video. Tap a section to edit it.' },
          { t: 'Drag sections to reorder', d: 'Put the most important thing first. People rarely scroll far.' },
          { t: 'Look at the preview', d: 'The phone preview shows exactly what visitors see.' },
        ],
      },
    ],
    tips: ['The eye icon hides a section without deleting it.', 'Anything marked “Example” is only visible to you until you edit it.'],
    stuck: [['My changes are not on my live page', 'Changes save by themselves. Reload your public link. If it is still old, make sure the Live switch is on.']],
  },

  '/dashboard/appearance': {
    title: 'Website: Design',
    purpose: 'Colours, fonts and button styles for your whole site. It changes how your page looks, not what is on it.',
    flows: [
      {
        name: 'Make it look like you',
        steps: [
          { t: 'Pick a theme close to your style', d: 'Start from a theme and adjust it. It is faster than starting from zero.' },
          { t: 'Change the colours', d: 'Use your brand colour for buttons. Keep text dark on light backgrounds, or light on dark.' },
          { t: 'Choose fonts', d: 'One font for headings and one for text looks tidy.' },
          { t: 'Check phone and computer', d: 'Most visitors use a phone, so look at the phone preview first.' },
        ],
      },
    ],
    tips: ['Want a completely new look in one tap? Use the Templates tab.'],
  },

  '/dashboard/templates': {
    title: 'Website: Templates',
    purpose: 'Ready-made designs. Tap one and your own content appears in it. Your content is never lost.',
    flows: [
      {
        name: 'Try a new template',
        steps: [
          { t: 'Tap a design', d: 'You see it with your own name, photo and links.' },
          { t: 'Choose what changes', d: '“Only the look” keeps your pages as they are. The other option also rearranges sections.' },
          { t: 'Apply it', d: 'You can switch back any time.' },
        ],
      },
    ],
    tips: ['If you are happy with your pages, choose “Only the look”.'],
  },

  '/dashboard/products': {
    title: 'Products',
    purpose: 'Create the things you sell: PDFs and files, 1:1 calls, webinars, memberships, paid messages. Buyers pay on your page and get access automatically. Your earning reaches your UPI within 2 working days.',
    flows: [
      {
        name: 'Add your first product',
        steps: [
          PAYOUT,
          { t: 'Press “New product”', d: 'It is the button at the top right of this page.' },
          { t: 'Choose what you are selling', d: 'Digital product (a file), 1:1 session, webinar, membership, paid message. A course or brand product sold on another website only needs its link.' },
          { t: 'Add a title, picture and price', d: 'The price is what the buyer pays. Add GST yourself if you charge it. The screen shows what you receive after our platform charge.' },
          { t: 'Add what the buyer gets', d: 'Upload the file, or add the meeting link. Buyers see it right after paying.' },
          { t: 'Switch “Publish” on', d: 'Now it appears on your Shop page and buyers can pay.' },
        ],
      },
    ],
    tips: ['Free products do not need a UPI ID.', 'Your plan limits how many products can be live at once. Switch one off to free a place.'],
    stuck: [
      ['I cannot set a price', 'Add your payout UPI ID in Settings, Payouts first. Paid products need it.'],
      ['My product is not showing', 'Check that it is published and that your page is Live.'],
    ],
  },

  '/dashboard/products/*': {
    title: 'Edit product',
    purpose: 'All the details of one product. The screen tells you what is still missing before you can publish.',
    flows: [
      {
        name: 'Finish and publish',
        steps: [
          { t: 'Write a clear title', d: 'Say what the buyer gets, for example “30 Instagram Reel ideas (PDF)”.' },
          { t: 'Add a picture', d: 'A clean cover makes people tap.' },
          { t: 'Set the price', d: 'Final price including GST if you charge it. You will see what lands with you after our charge.' },
          { t: 'Add what buyers get', d: 'The file, link or message they receive after paying.' },
          { t: 'Turn on “Publish”', d: 'It goes live on your Shop page.' },
        ],
      },
    ],
    tips: ['An offer price with an end date shows a countdown on Creator and Pro plans.'],
  },

  '/dashboard/sales': {
    title: 'Sales',
    purpose: 'Every order, booking and question from buyers. Money from sales is yours minus our platform charge, sent to your UPI within 2 working days.',
    flows: [
      {
        name: 'Look after an order',
        steps: [
          { t: 'Open the Orders tab', d: 'You see who bought what and when.' },
          { t: 'Press “Invoice”', d: 'Opens the buyer’s invoice. Print it or save it as a PDF.' },
          { t: 'Check your earnings', d: 'Settings, Payouts shows what you earned today and what is on its way.' },
        ],
      },
      {
        name: 'A buyer wants a refund',
        steps: [
          { t: 'Ask them to email support@joinlyy.com', d: 'They send your name, the product and a screenshot of the payment.' },
          { t: 'Press “Refund” on the order', d: 'This ends their access. We send the money back to them.' },
        ],
      },
    ],
    tips: ['Bookings and paid questions have their own tabs.'],
  },

  '/dashboard/content': {
    title: 'Content & forms',
    purpose: 'Extra things for your page: an email sign-up form, videos, Spotify, reviews, FAQ and countdowns.',
    flows: [
      {
        name: 'Add something to your page',
        steps: [
          { t: 'Tap what you want to add', d: 'For example “Lead form”.' },
          { t: 'Fill it in', d: 'It saves by itself.' },
          { t: 'Choose where it shows', d: 'Move it in Website, Pages.' },
        ],
      },
    ],
    tips: ['A free gift (like a checklist) gets many more sign-ups than just “Subscribe”.'],
  },

  '/dashboard/deals': {
    title: 'Brand: Collabs',
    purpose: 'Keep every brand deal in one place, from the first message to getting paid.',
    flows: [
      {
        name: 'Run a deal',
        steps: [
          { t: 'A brand writes to you', d: 'Enquiries from your brand form land here by themselves.' },
          { t: 'Open the deal', d: 'Set its value, dates and what you will deliver.' },
          { t: 'Drag it to the next stage', d: 'For example from “Negotiating” to “In progress”.' },
          { t: 'Send an invoice', d: 'Open the Invoices tab to bill the brand.' },
          { t: 'Mark “Payment received”', d: 'It counts in your earnings.' },
        ],
      },
    ],
  },

  '/dashboard/brand-form': {
    title: 'Brand: Brand form',
    purpose: 'The form brands fill to contact you, so enquiries come to one place instead of scattered DMs.',
    flows: [
      {
        name: 'Set it up',
        steps: [
          { t: 'Add the form to your site', d: 'It appears as a “Work with me” section.' },
          { t: 'Write what work you accept', d: 'Mention your niche and audience for better enquiries.' },
          { t: 'Make your page Live', d: 'Brands can now find it.' },
        ],
      },
    ],
  },

  '/dashboard/invoices': {
    title: 'Brand: Invoices',
    purpose: 'Invoices you send to brands. Your buyers’ invoices for product sales are made automatically and live in Sales.',
    flows: [
      {
        name: 'Send an invoice',
        steps: [
          { t: 'Add your business details once', d: 'Name, address, GSTIN if you have one, and where to pay you.' },
          { t: 'Create an invoice', d: 'Start from a deal to fill most of it.' },
          { t: 'Download or print it', d: 'It is one clean page.' },
          { t: 'Mark it paid', d: 'When the money arrives.' },
        ],
      },
    ],
    tips: ['No GSTIN? Leave it empty and no GST is added.', 'Check tax rules with your accountant before the first invoice.'],
  },

  '/dashboard/media-kit': {
    title: 'Brand: Media kit',
    purpose: 'A one-page profile that shows brands your reach. You send the link or the PDF in your pitches.',
    flows: [
      {
        name: 'Make your media kit',
        steps: [
          { t: 'Connect Instagram', d: 'Followers, average likes and reach fill in by themselves.', go: ['Open Settings', '/dashboard/settings'] },
          { t: 'Write about you and your audience', d: 'Who follows you, which cities, what age.' },
          { t: 'Add your rates and past work', d: 'Leave a price empty to show “On request”.' },
          { t: 'Share the link or download the PDF', d: 'Use the buttons at the top.' },
        ],
      },
    ],
  },

  '/dashboard/audience': {
    title: 'Audience',
    purpose: 'Everyone who bought from you or signed up. The tabs on top also hold your free Instagram tools.',
    flows: [
      {
        name: 'What the tabs do',
        steps: [
          { t: 'Everyone', d: 'All buyers and sign-ups in one list. Filter, tag and export.' },
          { t: 'Leads', d: 'People who filled your sign-up form.' },
          { t: 'DM automation', d: 'Free. Replies to comments automatically.', go: ['Open DM automation', '/dashboard/automations'] },
          { t: 'Schedule posts', d: 'Free. Posts to Instagram at a time you pick.', go: ['Open Schedule posts', '/dashboard/schedule'] },
        ],
      },
    ],
    tips: ['Only contact people who agreed to hear from you.'],
  },

  '/dashboard/leads': {
    title: 'Audience: Leads',
    purpose: 'People who gave you their email or number through your form.',
    flows: [
      {
        name: 'Follow up',
        steps: [
          { t: 'Check new sign-ups', d: 'They appear here the moment they join.' },
          { t: 'Add tags', d: 'For example “webinar” to group people.' },
          { t: 'Export or message them', d: 'Export is on the Creator and Pro plans.' },
        ],
      },
    ],
  },

  '/dashboard/automations': {
    title: 'Audience: DM automation',
    purpose: 'Free. When someone comments a word you choose (like GUIDE) on your post or Reel, Joinlyy replies in public and sends them a DM with your link. You do nothing.',
    flows: [
      {
        name: 'Create a comment-to-DM reply',
        steps: [
          { t: 'Connect Instagram', d: 'Use a Business or Creator account. Do it once.', go: ['Open Settings', '/dashboard/settings'] },
          { t: 'Press “New automation” or pick a template', d: 'The template “Comment GUIDE → DM” fills most of it.' },
          { t: 'Choose the keyword', d: 'A short word people will type, like GUIDE or PRICE.' },
          { t: 'Write the DM and add your link', d: 'This is what they receive in their messages.' },
          { t: 'Save it', d: 'It is now on. Posts you already have will work too.' },
        ],
      },
      {
        name: 'Test it',
        steps: [
          { t: 'Comment your keyword from a different account', d: 'Use a friend’s account or a second one of yours.' },
          { t: 'Look at “Recent activity”', d: 'You will see the reply and the DM sent.' },
        ],
      },
    ],
    tips: ['Instagram allows one private reply per comment.', 'Story replies and keyword DMs are on Creator and Pro plans.'],
    stuck: [['Nothing was sent', 'Check Instagram shows Connected in Settings and that the keyword matches. Reconnect Instagram if you connected a long time ago.']],
  },

  '/dashboard/schedule': {
    title: 'Audience: Schedule posts',
    purpose: 'Free post scheduler. Upload now, pick a time, and Joinlyy posts it to your Instagram for you, even while you sleep.',
    flows: [
      {
        name: 'Schedule a post',
        steps: [
          { t: 'Connect Instagram', d: 'Do it once in Settings. Use a Business or Creator account.', go: ['Open Settings', '/dashboard/settings'] },
          { t: 'Choose the type', d: 'Image is one photo. Carousel is 2 to 10 photos people swipe. Reel is one video.' },
          { t: 'Upload your file', d: 'For a carousel you see all photos side by side and can reorder them.' },
          { t: 'Write the caption', d: 'Add hashtags here too.' },
          { t: 'Pick a time or press “Post now”', d: 'Time is India time. You can schedule up to 75 days ahead.' },
        ],
      },
      {
        name: 'Your limits',
        steps: [
          { t: 'Free: 1 post a day, 15 Reels a month', d: 'Creator: 3 a day, 40 Reels. Pro: 3 a day, 50 Reels.' },
        ],
      },
    ],
    tips: ['Your uploaded file is deleted once the post is live. We only keep the link, time and status.', 'You can cancel a scheduled post before it goes out.'],
    stuck: [
      ['It says failed', 'The reason is shown under the post. If Instagram asked for permission, reconnect Instagram in Settings and press “Try again”.'],
      ['I hit my limit', 'The limit counts per day (India time) and per month for Reels. Pick another day, or upgrade in Settings, Plan.'],
    ],
  },

  '/dashboard/analytics': {
    title: 'Analytics',
    purpose: 'See how many people visit, what they tap and what sells. The free plan shows the last 30 days.',
    flows: [
      {
        name: 'Use it weekly',
        steps: [
          { t: 'Pick a date range', d: '7, 30, 90 days or a custom range, up to what your plan allows.' },
          { t: 'See which links get taps', d: 'The most tapped items are what your followers want.' },
          { t: 'Move your best items higher', d: 'Go to Website and drag them to the top.' },
        ],
      },
    ],
    tips: ['Look once a week. Daily numbers jump around too much.'],
  },

  '/dashboard/settings': {
    title: 'Settings',
    purpose: 'Your social links, connections and account.',
    flows: [
      {
        name: 'Set these up once',
        steps: [
          { t: 'Add your social links', d: 'Each shows as an icon under your name.' },
          { t: 'Connect Instagram', d: 'Scroll to the Instagram card and press Connect. Allow the permissions it asks for.' },
          { t: 'Add your payout UPI ID', d: 'Open the Payouts tab. Needed to sell.', go: ['Open Payouts', '/dashboard/payouts'] },
          { t: 'Turn on two-step login', d: 'It protects your account if your password leaks.' },
        ],
      },
    ],
    tips: ['Changing your page address breaks links you already shared.'],
  },

  '/dashboard/team': {
    title: 'Settings: Team',
    purpose: 'Let other people help you run your page, with only the access they need.',
    flows: [
      {
        name: 'Invite someone',
        steps: [
          { t: 'Type their email', d: 'They need a Joinlyy account with that email.' },
          { t: 'Choose a role', d: 'Give the lowest access that lets them do the job.' },
          { t: 'Send the invite', d: 'They accept it from their own dashboard.' },
        ],
      },
    ],
    tips: ['Team access is on Creator and Pro plans.'],
  },

  '/dashboard/payouts': {
    title: 'Settings: Payouts',
    purpose: 'How you get paid, what you earned, and the tax details printed on your buyers’ invoices.',
    flows: [
      {
        name: 'Get paid',
        steps: [
          { t: 'Add your payout UPI ID and name', d: 'It must be yours. We send your earnings here.' },
          { t: 'A buyer pays on your page', d: 'The money comes to Joinlyy first.' },
          { t: 'Our platform charge is taken', d: '15% on Starter, 10% on Creator, 5% on Pro. The rest is yours.' },
          { t: 'Your earning reaches your UPI', d: 'Within 2 working days of the sale. You get an email each time.' },
        ],
      },
      {
        name: 'Invoices for your buyers',
        steps: [
          { t: 'Open “Tax and invoice details”', d: 'Scroll down on this page.' },
          { t: 'Add your business name and address', d: 'These print on every invoice.' },
          { t: 'Add your GSTIN if you have one', d: 'With a GSTIN, invoices are GST invoices (the price is split into taxable value, CGST and SGST). Without one, invoices show no GST.' },
        ],
      },
    ],
    tips: ['“You earned today” and “On its way to you” show where your money is.', 'The table lists every sale with the price, our charge and what you receive.'],
  },

  '/dashboard/billing': {
    title: 'Settings: Plan',
    purpose: 'Your plan, what it includes and how much you have used.',
    flows: [
      {
        name: 'Upgrade',
        steps: [
          { t: 'Compare the plans', d: 'Starter is free. Creator and Pro add more limits and extras.' },
          { t: 'Press “Subscribe with autopay”', d: 'The payment window opens.' },
          { t: 'Pay by UPI, card or net banking', d: '18% GST is added at checkout.' },
          { t: 'Done', d: 'Your plan switches on and renews by itself. Turn auto-renew off any time here.' },
        ],
      },
    ],
    tips: ['If you turn auto-renew off, your plan stays until the end of the period you paid for.'],
    stuck: [['I paid but it still says pending', 'Press “Check my payment”. If it is still not on after a few minutes, message us from Settings, Messages.']],
  },

  '/dashboard/referrals': {
    title: 'Settings: Refer & earn',
    purpose: 'Invite other creators with your own link and get rewards when they join.',
    flows: [
      {
        name: 'Refer a creator',
        steps: [
          { t: 'Copy your link', d: 'It is at the top of this page.' },
          { t: 'Send it to a creator', d: 'On WhatsApp, Instagram or email.' },
          { t: 'Watch who joins', d: 'They appear on this page.' },
        ],
      },
    ],
  },

  '/dashboard/messages': {
    title: 'Settings: Messages',
    purpose: 'Write to our team and read their replies.',
    flows: [
      {
        name: 'Ask for help',
        steps: [
          { t: 'Say what happened', d: 'One or two clear sentences.' },
          { t: 'Name the page you were on', d: 'For example “Products”, so we can find it quickly.' },
          { t: 'Check back here', d: 'We reply on this page and by email.' },
        ],
      },
    ],
  },

  '/dashboard/guide': {
    title: 'Guide',
    purpose: 'The full guide to how everything works, in one place.',
    flows: [
      {
        name: 'How to use it',
        steps: [
          { t: 'Read “How it works” first', d: 'Six short steps from sign-up to your first visitor.' },
          { t: 'Use “What things mean”', d: 'When a word is unclear.' },
          { t: 'Finish “The minimum you need”', d: 'Before you switch your page to Live.' },
        ],
      },
    ],
  },
}

/** The help for the page being shown, or null */
export function findFlow(path) {
  const clean = path.replace(/\/+$/, '') || '/'
  if (FLOWS[clean]) return FLOWS[clean]
  if (clean.startsWith('/dashboard/products/')) return FLOWS['/dashboard/products/*']
  return null
}
