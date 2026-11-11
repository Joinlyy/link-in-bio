// Creator Academy — practical guides for Indian creators.
// Each section body is a list of blocks: a string (paragraph), { list: [] }, { steps: [] } or { tip: '' }.

export const ARTICLES = [
  {
    slug: 'set-up-your-page',
    title: 'Set up your page in 10 minutes',
    category: 'Getting started',
    minutes: 5,
    tone: 'bg-lime',
    summary: 'Username, photo, bio, first five blocks and publishing — the fastest path from sign-up to a page worth sharing.',
    sections: [
      {
        id: 'username',
        heading: 'Pick a username people can type',
        body: [
          'Your username becomes your link, so keep it identical to your Instagram or YouTube handle whenever possible. Fans already know it, and it looks trustworthy to brands.',
          { list: ['Avoid extra dots and underscores — they get mistyped on WhatsApp.', 'Skip numbers unless they are part of your brand.', 'Shorter is better: it has to fit inside a 150-character Instagram bio.'] },
        ],
      },
      {
        id: 'profile',
        heading: 'Photo and display name',
        body: [
          'Use the same profile photo as your main social account — a clear face crop on a plain background works best at small sizes.',
          'Your display name can include what you do: “Priya · Home Chef” tells a new visitor everything in one line.',
        ],
      },
      {
        id: 'first-blocks',
        heading: 'Add your first five blocks',
        body: [
          'Start with what you want people to do most, then add supporting links. A good starter set:',
          { steps: ['Your latest video or reel', 'A product, course or booking link (even a free one)', 'A lead form to collect emails or WhatsApp numbers', 'A WhatsApp button for brand enquiries', 'Your other social profiles'] },
          { tip: 'Fewer, clearer links convert better than 20 options. Archive old links instead of stacking them.' },
        ],
      },
      {
        id: 'publish',
        heading: 'Publish and share',
        body: [
          'Flip the Live switch at the top of your dashboard. Then paste your link in your Instagram bio, YouTube channel description, pinned comments and WhatsApp status.',
          'Download your QR code from the Overview page for packaging, visiting cards and event standees.',
        ],
      },
    ],
  },
  {
    slug: 'bio-link-best-practices',
    title: 'Bio link best practices that actually get clicks',
    category: 'Growth',
    minutes: 6,
    tone: 'bg-lilac-100',
    summary: 'Ordering, naming and refreshing your links so more of your followers tap through — and buy.',
    sections: [
      {
        id: 'order',
        heading: 'Put one hero action at the top',
        body: [
          'Most visitors only see the first two or three blocks before deciding. Put the one action you care about this week at the top, and rotate it as your content changes.',
          { tip: 'Talking about a product in today’s reel? Move that product to position one before you post.' },
        ],
      },
      {
        id: 'titles',
        heading: 'Write button titles like promises',
        body: [
          '“Shop” and “Link” tell people nothing. Say what they get and, when relevant, the price.',
          { list: ['“Get my 7-day Hindi spoken English plan — ₹199”', '“Watch: my ₹15K home studio setup”', '“Free: 30 easy tiffin recipes PDF”'] },
        ],
      },
      {
        id: 'cta',
        heading: 'Tell people to tap the link',
        body: [
          'Every reel, story and video should end with a specific call to action: “Recipe PDF is in my bio — link pe tap karo.” Mention what they will find, not just that a link exists.',
          'Use Instagram story link stickers and YouTube pinned comments too — the same page works everywhere.',
        ],
      },
      {
        id: 'refresh',
        heading: 'Clean up every Sunday',
        body: [
          'Open Analytics once a week. Remove or archive links with almost no clicks, and test a new title for your top link. Small weekly tweaks compound fast.',
        ],
      },
    ],
  },
  {
    slug: 'sell-digital-products',
    title: 'Selling digital products: e-books, presets and templates',
    category: 'Earn',
    minutes: 7,
    tone: 'bg-white',
    summary: 'Choose a first product, price it in rupees that feel right, and deliver it automatically after UPI payment.',
    sections: [
      {
        id: 'what',
        heading: 'What sells well in India',
        body: [
          'Products that save time or money sell best. Think of the questions your DMs keep asking and package the answer.',
          { list: ['Recipe or meal-plan PDFs', 'Lightroom presets and Canva templates', 'Notion study planners for exam aspirants', 'Excel trackers for budgeting or fitness', 'Short recorded mini-courses'] },
        ],
      },
      {
        id: 'pricing',
        heading: 'Price for impulse, then go up',
        body: [
          'Start between ₹99 and ₹499 — an amount people can pay on UPI without overthinking. Once you have reviews and sales, launch a bigger bundle at ₹999+ and keep the cheap product as an entry point.',
          { tip: 'Use a limited-time coupon in your launch week. Urgency plus a story countdown works better than a permanent discount.' },
        ],
      },
      {
        id: 'listing',
        heading: 'Write a product page that sells',
        body: [
          { steps: ['A clear title with the outcome (“Lose 5 kg with desi food”)', 'A cover image that looks good as a thumbnail', '3–5 bullets of exactly what is inside', 'Who it is for — and who it is not for', 'Your refund promise, so buyers feel safe'] },
        ],
      },
      {
        id: 'after-sale',
        heading: 'After the sale',
        body: [
          'Buyers get an instant access link by email. Add an upsell — a bundle or a 1:1 call — to raise your average order value, and follow up with buyers through your Audience list for the next launch.',
        ],
      },
    ],
  },
  {
    slug: 'paid-webinars-and-calls',
    title: 'Running paid webinars and 1:1 sessions',
    category: 'Earn',
    minutes: 6,
    tone: 'bg-lime',
    summary: 'Turn your expertise into bookable time — consultations, mentorship calls and live workshops.',
    sections: [
      {
        id: 'format',
        heading: 'Pick the right format',
        body: [
          'One-to-one calls are ideal for personalised advice (resume reviews, diet plans, career guidance). Webinars scale the same knowledge to many people at a lower price.',
          { list: ['1:1 call: ₹499–₹2,999 for 20–45 minutes', 'Group webinar: ₹99–₹499 per seat', 'Cohort or workshop series: ₹1,999+'] },
        ],
      },
      {
        id: 'availability',
        heading: 'Set availability you can keep',
        body: [
          'Block only the slots you can genuinely honour. Missed sessions lead to disputes and refunds, which hurt your trust score. Add buffer time between calls.',
          { tip: 'Evening slots (7–10 pm IST) and Sunday mornings book fastest for working professionals and students.' },
        ],
      },
      {
        id: 'promote',
        heading: 'Fill the seats',
        body: [
          { steps: ['Announce the date 7–10 days early with a reel explaining one takeaway', 'Pin the booking block at the top of your page', 'Post a countdown story daily for the last 3 days', 'Send a reminder to your lead list the morning of the event'] },
        ],
      },
      {
        id: 'deliver',
        heading: 'Deliver and re-sell',
        body: [
          'Record webinars (with permission) and sell the replay as a digital product afterwards. Ask attendees for a one-line testimonial — they are your best marketing for the next batch.',
        ],
      },
    ],
  },
  {
    slug: 'brand-deals-gst-invoices',
    title: 'Brand deals, rate cards and GST invoices',
    category: 'Business',
    minutes: 8,
    tone: 'bg-lilac-100',
    summary: 'Pitch brands with a media kit, agree deliverables in writing, and invoice correctly — including GST and TDS basics.',
    sections: [
      {
        id: 'media-kit',
        heading: 'Lead with a media kit',
        body: [
          'Brands want numbers: followers, average views, audience cities, age and gender. Your live media kit link updates automatically, so you never send an outdated PDF.',
          { tip: 'Add 2–3 past collaborations with results (“42K views, 1,100 link clicks”). Proof beats follower count.' },
        ],
      },
      {
        id: 'rate-card',
        heading: 'Build a simple rate card',
        body: [
          'Price per deliverable, not per follower. Include usage rights and exclusivity as add-ons.',
          { list: ['1 Reel + 1 Story', 'Dedicated YouTube integration (60–90 sec)', 'Link in bio for 7 days', 'Paid usage rights for 30 days (+30–50%)'] },
        ],
      },
      {
        id: 'contract',
        heading: 'Get it in writing',
        body: [
          'Before posting, confirm deliverables, timelines, number of revisions, payment terms (e.g. 50% advance) and usage rights over email at minimum. Track each deal’s stage in Brand deals so nothing slips.',
        ],
      },
      {
        id: 'gst',
        heading: 'GST and TDS basics',
        body: [
          'If your annual service income crosses ₹20 lakh (₹10 lakh in special-category states), GST registration is mandatory and you charge 18% GST — CGST + SGST within your state, IGST for other states. Brands usually deduct TDS (Section 194J or 194R) — this shows up in your Form 26AS and can be claimed while filing ITR.',
          { list: ['Use a sequential invoice number', 'Include your GSTIN and the brand’s GSTIN', 'Mention SAC code 998361 (advertising services) or as advised', 'Keep a copy of every invoice for filing'] },
          { tip: 'This is general information, not tax advice. Speak to a CA once your creator income becomes regular.' },
        ],
      },
    ],
  },
  {
    slug: 'dm-automation',
    title: 'Growing with Instagram DM automation',
    category: 'Growth',
    minutes: 6,
    tone: 'bg-white',
    summary: 'Use “comment a keyword, get the link in DM” to boost reach, collect leads and close sales while you sleep.',
    sections: [
      {
        id: 'why',
        heading: 'Why comment-to-DM works',
        body: [
          'When people comment a keyword, the algorithm sees engagement and pushes your reel further. The automatic DM then delivers the link instantly — no “link in bio, scroll up” friction.',
        ],
      },
      {
        id: 'setup',
        heading: 'Set up your first rule',
        body: [
          { steps: ['Connect your Instagram professional account in Settings', 'Create a rule with a simple keyword like “RECIPE” or “GUIDE”', 'Write a warm DM with the link and one line of context', 'Mention the keyword clearly on screen and in the caption'] },
          { tip: 'Pick keywords in the language your audience comments in — “PDF” or “LINK” work across Hindi and English audiences.' },
        ],
      },
      {
        id: 'leads',
        heading: 'Collect leads and require follows',
        body: [
          'Ask for an email or WhatsApp number before sending the freebie to build a list you own. Follow-to-unlock grows followers, but use it sparingly — too many gates feel spammy.',
        ],
      },
      {
        id: 'rules',
        heading: 'Stay within Instagram’s rules',
        body: [
          'Reply only to people who interacted with you, keep messages relevant, and avoid sending the same promotional DM repeatedly. Automations run through Meta’s official API, so your account stays safe.',
        ],
      },
    ],
  },
  {
    slug: 'analytics-and-utm-links',
    title: 'Using analytics and UTM links',
    category: 'Growth',
    minutes: 5,
    tone: 'bg-lime',
    summary: 'Find out which platform, post and link actually drives your clicks and sales — then do more of it.',
    sections: [
      {
        id: 'metrics',
        heading: 'The four numbers that matter',
        body: [
          { list: ['Views — how many people opened your page', 'Unique visitors — how many different people', 'Click-through rate — clicks ÷ views (aim for 30%+)', 'Conversions — leads and sales from those visits'] },
        ],
      },
      {
        id: 'utm',
        heading: 'Tag every link you share',
        body: [
          'Add ?utm_source= to your page link so you know where visitors came from. For example: yourname?utm_source=youtube in your video description, and ?utm_source=whatsapp in your status.',
          { tip: 'Your QR code already includes utm_source=qr, so offline traffic shows up separately.' },
        ],
      },
      {
        id: 'act',
        heading: 'Turn data into decisions',
        body: [
          'If YouTube visitors buy more than Instagram visitors, mention your product in every video. If a link gets views but no clicks, rewrite its title. Review once a week, change one thing, and compare.',
        ],
      },
    ],
  },
  {
    slug: 'hindi-content-tips',
    title: 'Hindi and Hinglish content tips',
    category: 'Content',
    minutes: 5,
    tone: 'bg-lilac-100',
    summary: 'Reach Bharat beyond the metros — writing, captions and page setup for Hindi-first audiences.',
    sections: [
      {
        id: 'language',
        heading: 'Write the way your audience speaks',
        body: [
          'Most Indian audiences read Hinglish comfortably. Use Devanagari for emotional hooks and Roman Hindi or English for product names, prices and links.',
          { list: ['“Ghar pe banao restaurant jaisa paneer 🧀”', '“₹199 mein poora 30-day plan”', '“Link bio mein hai — abhi dekho”'] },
        ],
      },
      {
        id: 'page',
        heading: 'Set your page language',
        body: [
          'Switch your page language to Hindi in Settings so buttons and labels appear in Hindi for your visitors. Write your bio in the same mix you use in your reels.',
        ],
      },
      {
        id: 'trust',
        heading: 'Build trust for first-time buyers',
        body: [
          'Many visitors from smaller cities are buying online from a creator for the first time. Show UPI as the payment method, mention your refund promise clearly, and add a WhatsApp button for questions.',
          { tip: 'A short video explaining “payment ke baad kya milega” can double conversions on Hindi-speaking audiences.' },
        ],
      },
      {
        id: 'consistency',
        heading: 'Consistency over perfection',
        body: [
          'Regional audiences reward relatable, regular content more than polished production. Post on a fixed schedule and reuse the same format so viewers know what to expect.',
        ],
      },
    ],
  },
]

export function findArticle(slug) {
  return ARTICLES.find((a) => a.slug === slug) || null
}
