// Search landing pages: one page per thing people search for. Used by the site (src/pages/SeoLanding.jsx),
// the sitemap and the edge function that puts the right title and description into the first HTML.
// Keep every claim true to what the product does today.

import { SEO_PAGES_MORE } from './seoPagesMore.js'

const BASE_PAGES = [
  {
    slug: 'link-in-bio-for-indian-creators',
    title: 'Link in Bio for Indian Creators: Sell, Book & Get Paid | Joinlyy',
    description: 'One link in bio to take UPI payments, sell digital products, book calls and auto-DM every comment. Built for Indian creators, in Hindi and English. Free to start.',
    h1: 'The link in bio built for Indian creators',
    kicker: 'Link in bio',
    intro: 'Joinlyy turns the one link in your Instagram, YouTube or WhatsApp bio into a small website that sells for you. Buyers pay by UPI, you get alerted on WhatsApp, and you never copy-paste a payment link into a DM again.',
    sections: [
      { h2: 'Everything a creator needs behind one link', body: [
        'Most link pages only list links. Joinlyy lets you sell, book and collect leads from the same page, so your followers can act without leaving your bio.',
        { list: ['Sell digital products, PDFs, presets, courses and memberships', 'Take paid 1:1 calls and webinar bookings with a calendar', 'Collect emails and phone numbers with lead forms', 'Show your latest Reel, YouTube video or Spotify playlist', 'Add a brand-deal enquiry form so sponsors can reach you'] },
      ] },
      { h2: 'Made for how India pays and chats', body: [
        'Your customers already pay by UPI and talk on WhatsApp. Joinlyy is built around both: buyers pay you by UPI, and you can get a WhatsApp message the moment an order, lead or brand enquiry arrives.',
        'Pages work in Hindi and English, with fonts that render Devanagari properly, and there are Hindi templates for recipes, teachers, parents and spiritual creators.',
      ] },
      { h2: '33 templates, then make it yours', body: [
        'Start from a template for your niche, from fashion and fitness to food, travel, education and gaming. Change colours, fonts, buttons and layout, or keep it as it is. You can publish in minutes.',
      ] },
      { h2: 'Know what works', body: [
        'See page views, link clicks, where visitors come from and which links earn. Creator and Pro plans keep a longer history and let you export your leads.',
      ] },
    ],
    faq: [
      ['Is Joinlyy free?', 'Yes. The Starter plan is free, with one page, free comment to DM automation and the core selling tools. Paid plans add more automations, WhatsApp alerts, more history and extras.'],
      ['Can I take UPI payments?', 'Yes. Buyers pay your UPI ID and you confirm the payment, so the money goes straight to you.'],
      ['Does it work in Hindi?', 'Yes. Pages, buttons and several templates are available in Hindi and English.'],
      ['Do I need to know how to code?', 'No. Pick a template, add your links and products and publish. Most creators finish in about ten minutes.'],
    ],
    related: ['how-to-add-link-in-bio-instagram', 'link-in-bio-ideas', 'best-link-in-bio-tools-india', 'link-in-bio-templates'],
  },
  {
    slug: 'instagram-comment-to-dm-automation',
    title: 'Instagram Comment to DM Automation, Free | Joinlyy',
    description: 'Auto-send a DM when someone comments a keyword on your Reel or post. Free comment to DM automation for Indian creators, with public replies and lead capture.',
    h1: 'Auto-DM everyone who comments on your Reels',
    kicker: 'Instagram automation',
    intro: 'Post a Reel, ask people to comment a word like "LINK", and Joinlyy sends each commenter a DM with your link, guide or offer. It works while you sleep, and it is free on the Starter plan.',
    sections: [
      { h2: 'How comment to DM works', body: [
        { list: ['Connect your Instagram professional account', 'Pick the Reel or post and choose a trigger word', 'Write the DM and the public reply people will see', 'Joinlyy replies to each comment and sends the DM automatically'] },
        'You stay in control: edit or pause any automation at any time, and see every DM sent in your dashboard.',
      ] },
      { h2: 'Free on the Starter plan', body: [
        'Comment to DM automation is included free, so you can start getting leads from your Reels without paying. Creator and Pro plans add more automations, higher monthly DM limits, story-reply and keyword automations, follow-to-unlock and follow-up messages.',
      ] },
      { h2: 'Turn comments into customers', body: [
        'Send your price list, your free guide, a booking link or a product page. Because the DM comes from your own account and answers a comment, it feels personal instead of spammy.',
        'Pair it with your Joinlyy page: the DM can link to a product, a lead form or a paid session, and you can see who bought.',
      ] },
      { h2: 'Safe by design', body: [
        'Automations use Instagram\'s official messaging API, only reply to people who comment or message you first, and respect monthly limits. You can switch them off whenever you want.',
      ] },
    ],
    faq: [
      ['Is comment to DM automation really free?', 'Yes, on the Starter plan you can run comment to DM automations at no cost, up to the plan limits.'],
      ['Do I need an Instagram business account?', 'You need an Instagram professional (business or creator) account connected to your Joinlyy account.'],
      ['Can I reply publicly as well?', 'Yes. You can post a public reply to each comment and send the DM at the same time.'],
      ['Can I use it for sales?', 'Yes. Send a product link, a booking link or a lead form and track the results from your dashboard.'],
    ],
    related: ['how-to-set-up-comment-to-dm', 'instagram-auto-reply-comments', 'instagram-dm-keywords-that-convert', 'manychat-alternative-india'],
  },
  {
    slug: 'sell-on-instagram-with-upi',
    title: 'Sell on Instagram with UPI: Products, Calls & Courses | Joinlyy',
    description: 'Sell PDFs, presets, courses, memberships and paid calls straight from your Instagram bio. Buyers pay by UPI. WhatsApp order alerts and automatic delivery.',
    h1: 'Sell on Instagram with UPI, from your bio link',
    kicker: 'Sell online',
    intro: 'You do not need a website or a payment gateway account to start selling. Add a product to your Joinlyy page, share the link, and your buyers pay by UPI. Digital products are delivered on the order page.',
    sections: [
      { h2: 'What you can sell', body: [
        { list: ['Digital downloads: PDFs, templates, presets, ebooks', 'Courses and communities, with your own course link or private content', 'Paid 1:1 calls and consultations with a booking calendar', 'Webinars and live classes with registration', 'Memberships, bundles and "ask me a question" products', 'Tips, for people who just want to say thanks'] },
      ] },
      { h2: 'How a sale works', body: [
        'A buyer opens your product, pays your UPI ID and sends the payment reference. You confirm it, and the buyer gets access on their order page right away. You are alerted by WhatsApp on paid plans, so you never miss an order.',
      ] },
      { h2: 'Sell more with simple tools', body: [
        'Add coupons, limited-time offers, pay-what-you-want pricing, bundles and upsells on the Creator and Pro plans. Collect GST details and generate invoices for brand deals.',
      ] },
      { h2: 'Support when something goes wrong', body: [
        'Every order page has a support button. If a payment looks stuck or a buyer does not receive a product, they can write to us from their order, and our team follows up.',
      ] },
    ],
    faq: [
      ['Do I need a payment gateway?', 'No. Buyers pay your UPI ID directly and you confirm each payment.'],
      ['How do buyers get digital products?', 'After you confirm the payment, the buyer opens their order page and downloads the file or accesses the content.'],
      ['Can I sell without a website?', 'Yes. Your Joinlyy page is your storefront, and every product has its own shareable link.'],
      ['What does it cost?', 'You can start on the free Starter plan. Creator is ₹199 a month and Pro is ₹399 a month, with two months free on yearly billing.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'creator-media-kit-generator', 'free-link-in-bio'],
  },
  {
    slug: 'linktree-alternative-india',
    title: 'Linktree Alternative for Indian Creators | Joinlyy',
    description: 'Looking for a Linktree alternative? Joinlyy adds UPI payments, free Instagram comment to DM automation, WhatsApp alerts and Hindi support to your link in bio.',
    h1: 'A Linktree alternative made for India',
    kicker: 'Comparison',
    intro: 'If you are comparing link in bio tools like Linktree, Beacons or Stan, here is what Joinlyy is built around: the way Indian creators sell, get paid and talk to their audience.',
    sections: [
      { h2: 'What is different', body: [
        { list: ['UPI payments: buyers pay your UPI ID directly', 'Free Instagram comment to DM automation on the Starter plan', 'WhatsApp alerts for new orders, leads and brand enquiries', 'Hindi and English pages, with Hindi templates', 'Prices in rupees: Creator ₹199 a month, Pro ₹399 a month', 'A one-click media kit PDF to send to brands'] },
      ] },
      { h2: 'What you still get', body: [
        'Everything you expect from a link in bio: unlimited links, social icons, 33 templates, themes and fonts, analytics, lead capture, embeds for YouTube, Instagram and Spotify, and a custom look for every page.',
      ] },
      { h2: 'Moving over takes minutes', body: [
        'Create your page, pick a template, paste your links and publish. Then swap the link in your Instagram bio. Nothing breaks: your followers just see a better page.',
      ] },
    ],
    faq: [
      ['Is Joinlyy free like other link in bio tools?', 'Yes, the Starter plan is free, and includes comment to DM automation, which many tools charge for.'],
      ['Can I keep my old link?', 'Run both for a while if you like. When you are ready, replace the link in your bio with your Joinlyy link.'],
      ['Is it only for Instagram creators?', 'No. Use the link anywhere: Instagram, YouTube, WhatsApp, Telegram, LinkedIn or a business card.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'free-link-in-bio', 'link-in-bio-templates'],
  },
  {
    slug: 'link-in-bio-templates',
    title: 'Link in Bio Templates: 33 Designs for Every Creator | Joinlyy',
    description: 'Browse 33 link in bio templates for fashion, fitness, food, travel, education, business, gaming, art and more, in Hindi and English. Free to use.',
    h1: '33 link in bio templates for every kind of creator',
    kicker: 'Templates',
    intro: 'Pick a design that fits your niche, then change anything. Every template is a complete page with a main button, products and a trust line, ready to publish.',
    sections: [
      { h2: 'Templates by niche', body: [
        { list: ['Creator: Spotlight, Essentials, Launch Drop, Bento Grid', 'Fashion and beauty: The Edit, Street Drop, Rose Glow, Skin Diary', 'Fitness and wellness: Iron Mode, Morning Flow, Nourish', 'Food: Kitchen Stories, Cloud Kitchen', 'Travel: Wanderlust, Trip Notes', 'Education: Study Room, Skill School, Webinar Hub', 'Business: Money Smart, Coach Pro, Studio Site', 'Tech and gaming: Dev Terminal, Player One', 'Entertainment: Laugh Track, Stage Lights, Dance Studio, On Air', 'Art and photo: Frame Gallery, Art Studio', 'Hindi: घर का खाना, परीक्षा गुरु, माँ की डायरी, शांति'] },
      ] },
      { h2: 'Different layouts, not just colours', body: [
        'Templates come in full-photo, banner, narrow single-column, big-type, colour-block and floating-card layouts, with gradient backgrounds, glass and gradient buttons, and one-page or multi-page structures.',
      ] },
      { h2: 'Change it your way', body: [
        'Switch templates at any time without losing your content. Adjust fonts, colours, button style and layout from the Appearance screen.',
      ] },
    ],
    faq: [
      ['Are the templates free?', 'Yes, every template is available on the free Starter plan.'],
      ['Can I change template later?', 'Yes. Your links and products stay as they are when you switch.'],
      ['Are there Hindi templates?', 'Yes, there are Hindi templates for recipes, teachers, parents and spiritual creators.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'free-link-in-bio', 'creator-media-kit-generator'],
  },
  {
    slug: 'creator-media-kit-generator',
    title: 'Free Creator Media Kit Generator (PDF) | Joinlyy',
    description: 'Create a colourful creator media kit with your Instagram stats and past work, then download it as a PDF to send to brands. Free for Indian creators.',
    h1: 'A media kit you can send to brands in one click',
    kicker: 'Media kit',
    intro: 'Brands ask for a media kit before they ask for a price. Joinlyy builds one from your profile and Instagram stats, with your rates and past work, and gives you a PDF and a shareable link.',
    sections: [
      { h2: 'What goes in your media kit', body: [
        { list: ['Your photo, bio and niche', 'Instagram followers, reach and engagement, imported from your connected account', 'Audience details and top content', 'Your services and rates', 'Past collaborations and contact details'] },
      ] },
      { h2: 'PDF and link, always up to date', body: [
        'Download a colourful PDF that keeps the layout you see on screen, or share a link that always shows your latest numbers.',
      ] },
      { h2: 'Get brand enquiries on your page', body: [
        'Add a brand-deal form to your link in bio, so sponsors can send a brief with their budget. You are alerted on WhatsApp on paid plans.',
      ] },
    ],
    faq: [
      ['Is the media kit free?', 'Yes. Creating the media kit and downloading the PDF is included on the free plan.'],
      ['Where do the stats come from?', 'From your connected Instagram professional account, so they are real numbers.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'sell-on-instagram-with-upi', 'instagram-comment-to-dm-automation'],
  },
  {
    slug: 'free-link-in-bio',
    title: 'Free Link in Bio Page with UPI & Instagram DM Automation | Joinlyy',
    description: 'Start free: a link in bio page with 33 templates, free Instagram comment to DM automation, lead capture and analytics. Upgrade only when you grow.',
    h1: 'A free link in bio that does more than list links',
    kicker: 'Free plan',
    intro: 'The Starter plan is free, with no time limit. You get a full link in bio page, selling tools and Instagram comment to DM automation, so you can grow before you pay anything.',
    sections: [
      { h2: 'Included on Starter, free', body: [
        { list: ['One link in bio page with all 33 templates', 'Unlimited links, social icons and embeds', 'Free comment to DM automation (10 automations, 1,000 DMs a month)', 'Digital products, paid sessions and lead forms', 'Media kit and PDF download', 'Page analytics and a Hindi and English interface'] },
      ] },
      { h2: 'Upgrade when it makes sense', body: [
        'Creator is ₹199 a month and Pro is ₹399 a month, with two months free on yearly billing. Paid plans add WhatsApp alerts, more automations and DMs, coupons and offers, longer analytics history, lead export, team access and removing our branding.',
      ] },
    ],
    faq: [
      ['Is the free plan really free?', 'Yes, there is no trial and no card needed. Starter stays free.'],
      ['What do I get when I upgrade?', 'More automations and DMs, WhatsApp alerts for you and your buyers, sales tools, longer analytics and priority help.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'linktree-alternative-india', 'instagram-comment-to-dm-automation'],
  },
]

export const SEO_PAGES = [...BASE_PAGES, ...SEO_PAGES_MORE]

export const findSeoPage = (slug) => SEO_PAGES.find((p) => p.slug === slug)
