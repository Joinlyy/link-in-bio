// More search landing pages, built around the two things people search for most: free Instagram comment to DM
// automation, and link in bio. `howto` adds step-by-step markup. Every claim matches what the product does today.

export const SEO_PAGES_MORE = [
  {
    slug: 'instagram-post-scheduler',
    title: 'Free Instagram Post Scheduler for Indian Creators: Photos, Carousels & Reels | Joinlyy',
    description: 'Schedule Instagram photos, carousels and Reels and let Joinlyy post them for you. Free on every plan: 1 post a day and 15 Reels a month. Made in India.',
    h1: 'A free Instagram post scheduler that posts for you',
    kicker: 'Auto-post',
    intro: 'Upload your photos or Reel, write the caption, pick a time and Joinlyy publishes it to your Instagram account. It is free on every plan, and it sits in the same account as your link in bio, your comment to DM automation and your store.',
    sections: [
      { h2: 'What you can schedule', body: [
        { list: ['Single photos', 'Carousels with 2 to 10 photos in one swipeable post', 'Reels (MP4 videos up to 50 MB)', 'Captions with hashtags, up to 2,200 characters', 'A time in India time, up to 75 days ahead, or Post now'] },
      ] },
      { h2: 'Limits by plan', body: [
        { list: ['Starter, free: 1 post a day and 15 Reels a month', 'Creator, Rs 199 a month: 3 posts a day and 40 Reels a month', 'Pro, Rs 399 a month: 3 posts a day and 50 Reels a month'] },
        'Cancelled and failed posts do not count towards your limits.',
      ] },
      { h2: 'Safe and simple', body: [
        'Joinlyy uses Instagram\'s official publishing API, so your password is never shared. It only publishes what you uploaded, to the account you connected, at the time you chose. Your uploaded files are deleted from our storage once the post is published, and we keep only the post link, time and status.',
      ] },
      { h2: 'One tool for your whole Instagram routine', body: [
        'Pair scheduled posts with free comment to DM automation: post a Reel at 7 pm, and everyone who comments your keyword gets your link in their DMs, even when you are offline.',
      ] },
    ],
    faq: [
      ['Is the Instagram post scheduler free?', 'Yes. Every plan includes it. Starter allows 1 post a day and 15 Reels a month, and the paid plans allow more.'],
      ['Can I schedule Reels and carousels?', 'Yes. You can schedule single photos, carousels of up to 10 photos and Reels.'],
      ['Do I need a Business or Creator account?', 'Yes. Instagram only allows publishing through its API for professional (Business or Creator) accounts.'],
      ['Is my account safe?', 'Joinlyy connects through Instagram\'s official login. You never share your password, and you can disconnect any time in Settings.'],
    ],
    related: ['how-to-schedule-instagram-posts', 'instagram-comment-to-dm-automation', 'link-in-bio-for-indian-creators'],
  },
  {
    slug: 'how-to-schedule-instagram-posts',
    title: 'How to Schedule Instagram Posts and Reels for Free (Step by Step) | Joinlyy',
    description: 'A simple guide to scheduling Instagram photos, carousels and Reels for free with Joinlyy: connect your account, upload, write the caption and pick a time.',
    h1: 'How to schedule Instagram posts and Reels for free',
    kicker: 'Guide',
    intro: 'You can plan a week of Instagram content in one sitting and let it post itself. This guide shows the steps in Joinlyy, which has a free Instagram post scheduler on every plan.',
    howto: { name: 'Schedule an Instagram post with Joinlyy', steps: [
      ['Connect Instagram', 'In Joinlyy open Settings, then Instagram, then Connect Instagram, and approve the permissions with your Business or Creator account.'],
      ['Open Schedule posts', 'Go to Audience, then Schedule posts.'],
      ['Add your photos or Reel', 'Choose one photo, up to 10 photos for a carousel, or one video for a Reel.'],
      ['Write the caption', 'Add your caption and hashtags.'],
      ['Pick the time', 'Choose a date and time in India time, or press Post now.'],
      ['Done', 'Joinlyy publishes the post at that time. You can see its status in the list and cancel it before it goes out.'],
    ] },
    sections: [
      { h2: 'Before you start', body: [
        { list: ['Switch your Instagram account to Business or Creator (free, in Instagram settings)', 'Have your photos or Reel ready on your phone or computer', 'Decide the best time: when your followers are online'] },
      ] },
      { h2: 'Tips for better scheduled posts', body: [
        'Keep carousel photos in the same shape. Joinlyy fits every photo into a 4:5 frame without cropping. Post Reels at a steady time each day, and pair them with a comment to DM keyword so every comment turns into a lead.',
      ] },
    ],
    faq: [
      ['How many posts can I schedule for free?', 'On Starter you can post 1 a day and up to 15 Reels a month.'],
      ['Can I schedule in advance?', 'Yes, up to 75 days ahead, and up to 30 posts can wait at a time.'],
    ],
    related: ['instagram-post-scheduler', 'schedule-instagram-reels-free', 'how-to-set-up-comment-to-dm'],
  },
  {
    slug: 'schedule-instagram-reels-free',
    title: 'Schedule Instagram Reels for Free: 15 Reels a Month on Joinlyy',
    description: 'Schedule Instagram Reels for free: 15 a month on Starter, 40 on Creator and 50 on Pro. Upload an MP4, write the caption and Joinlyy posts it for you.',
    h1: 'Schedule Instagram Reels for free',
    kicker: 'Reels',
    intro: 'Reels work best when you post on a steady schedule. Joinlyy lets you upload a Reel in advance and publishes it at the time you pick, with no cost on the Starter plan.',
    sections: [
      { h2: 'Reel limits', body: [
        { list: ['Starter, free: 15 Reels a month', 'Creator, Rs 199 a month: 40 Reels a month', 'Pro, Rs 399 a month: 50 Reels a month'] },
        'Reels are MP4 videos up to 50 MB. Your file is deleted from our storage after it is published.',
      ] },
      { h2: 'Turn Reel viewers into leads', body: [
        'Ask viewers to comment a keyword like GUIDE. Joinlyy replies in public and sends them a DM with your link, using the free comment to DM automation in the same account.',
      ] },
    ],
    faq: [
      ['Is scheduling Reels free?', 'Yes, 15 Reels a month are free on Starter.'],
      ['Can I post a Reel right now?', 'Yes. Choose Post now instead of a time.'],
    ],
    related: ['instagram-post-scheduler', 'instagram-comment-to-dm-automation', 'instagram-dm-keywords-that-convert'],
  },

  {
    slug: 'about',
    title: 'About Joinlyy: The Link in Bio Platform for Indian Creators',
    description: 'Joinlyy (pronounced join-lee, spelled with two y) is a link in bio and Instagram comment to DM automation platform made in India for creators. Learn what it does.',
    h1: 'About Joinlyy',
    kicker: 'About',
    intro: 'Joinlyy is a link in bio platform made in India for creators. It gives you one page for your bio link, free Instagram comment to DM automation, and simple ways to sell, book and get paid by UPI. You can also schedule your Instagram posts.',
    sections: [
      { h2: 'How to say and spell Joinlyy', body: [
        'Joinlyy is pronounced "join-lee" and spelled J-O-I-N-L-Y-Y, with two y at the end. If a search engine suggests a different spelling, check that it is spelled with the two y: joinlyy.com.',
        'Joinlyy is not related to other products or companies with a similar-sounding name.',
      ] },
      { h2: 'What Joinlyy does', body: [
        { list: ['A link in bio page with 33 templates, in Hindi and English', 'Free Instagram comment to DM automation, with public replies', 'Selling tools: digital products, paid calls, webinars, memberships and tips, paid by UPI',
        'An Instagram post scheduler for photos, carousels and Reels, free on every plan', 'A media kit PDF and a brand-deal enquiry form', 'WhatsApp alerts for new orders, leads and brand enquiries', 'Analytics, lead capture and a support button on every order'] },
      ] },
      { h2: 'Who it is for', body: [
        'Indian creators, coaches, teachers, small businesses and freelancers who share one link on Instagram, YouTube or WhatsApp and want that link to do more than list links.',
      ] },
      { h2: 'Follow Joinlyy', body: [
        'Follow @joinlyy on Instagram for product updates and tips, and read the Creator Academy for practical guides.',
      ] },
    ],
    faq: [
      ['How do you pronounce Joinlyy?', 'Say it "join-lee". It is written with two y at the end: Joinlyy.'],
      ['What is Joinlyy?', 'A link in bio platform for Indian creators, with free Instagram comment to DM automation, an Instagram post scheduler, UPI selling and WhatsApp alerts.'],
      ['Is Joinlyy the same as Joinly?', 'No. Joinlyy, spelled with two y, is a link in bio platform for creators. It is not related to products with a similar-sounding name.'],
      ['Is Joinlyy free?', 'Yes, the Starter plan is free, including comment to DM automation. Creator is ₹199 a month and Pro is ₹399 a month.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'instagram-comment-to-dm-automation', 'free-link-in-bio'],
  },
  {
    slug: 'how-to-set-up-comment-to-dm',
    title: 'How to Set Up Instagram Comment to DM Automation (Free)',
    description: 'Step-by-step: connect Instagram, pick a Reel, choose a keyword and auto-send a DM to everyone who comments. Free setup in about five minutes with Joinlyy.',
    h1: 'How to set up comment to DM automation on Instagram',
    kicker: 'How-to guide',
    intro: 'This takes about five minutes. You will connect your Instagram account, pick the Reel or post, choose a trigger word and write the DM people will receive.',
    howto: { name: 'Set up Instagram comment to DM automation', steps: [
      ['Create your free account', 'Sign up for Joinlyy with Google. The Starter plan is free and includes comment to DM automation.'],
      ['Connect Instagram', 'In Settings, connect your Instagram professional (business or creator) account. Joinlyy opens Instagram in a new tab so you can approve access.'],
      ['Open Automations', 'In your dashboard, open Automations and choose to add a new comment to DM automation.'],
      ['Pick the Reel or post', 'Choose the Reel or post that should trigger the DM from your latest media.'],
      ['Choose the trigger word', 'Pick a short word people will comment, such as LINK or GUIDE. Keep it easy to type.'],
      ['Write the public reply and the DM', 'Write a short public reply to each comment, then the DM with your link, guide or offer.'],
      ['Test with another account', 'Comment the word from a second account and check that the reply and DM arrive.'],
      ['Turn it on', 'Switch the automation on. You can pause or edit it at any time and see every DM sent in your dashboard.'],
    ] },
    sections: [
      { h2: 'Before you start', body: [
        { list: ['An Instagram professional account (business or creator)', 'A Reel or post worth promoting', 'A link, guide or offer to send in the DM'] },
      ] },
      { h2: 'Tips for better results', body: [
        { list: ['Ask for the word in the video and in the caption: "Comment GUIDE and I will send it"', 'Keep the DM short, with one clear link', 'Use a different trigger word for each Reel, so you can see which one works', 'Send people to a page that can capture their email or take payment'] },
      ] },
    ],
    faq: [
      ['How long does setup take?', 'About five minutes once your Instagram account is connected.'],
      ['Is it free?', 'Yes. Comment to DM automation is included on the free Starter plan, up to the plan limits.'],
      ['Can I change the DM later?', 'Yes. Edit or pause an automation whenever you like.'],
    ],
    related: ['instagram-comment-to-dm-automation', 'instagram-dm-keywords-that-convert', 'instagram-auto-reply-comments'],
  },
  {
    slug: 'instagram-auto-reply-comments',
    title: 'Auto Reply to Instagram Comments with a DM (Free Tool)',
    description: 'Reply to every Instagram comment automatically and send the commenter a DM with your link. How it works, example replies and what to avoid. Free for creators.',
    h1: 'Auto reply to Instagram comments, and send a DM too',
    kicker: 'Instagram automation',
    intro: 'When a Reel takes off, the comments pile up faster than you can answer. An automatic reply lets every commenter know you saw them, and the DM delivers what they asked for.',
    sections: [
      { h2: 'How auto reply works', body: [
        'You pick a post and a trigger word. When someone comments that word, Joinlyy posts a public reply under the comment and sends the commenter a DM. The public reply shows other viewers that the offer is real, which encourages more comments.',
      ] },
      { h2: 'Example replies', body: [
        { list: ['"Sent! Check your DMs 📩"', '"Done, I just sent you the link"', '"Thanks for commenting. The guide is in your inbox"'] },
        'Rotate a few replies so the comments do not all look identical.',
      ] },
      { h2: 'What to avoid', body: [
        { list: ['Do not send DMs to people who did not ask for anything', 'Do not put long sales pitches in the DM: one link, one clear next step', 'Do not promise something the link does not deliver'] },
      ] },
    ],
    faq: [
      ['Does the public reply show on my post?', 'Yes. The reply appears under the person\'s comment, like a normal reply.'],
      ['Will everyone who comments get a DM?', 'Everyone who comments the trigger word, up to the monthly DM limit of your plan.'],
      ['Is this allowed by Instagram?', 'Joinlyy uses Instagram\'s official messaging API and only messages people who commented or messaged you first.'],
    ],
    related: ['instagram-comment-to-dm-automation', 'how-to-set-up-comment-to-dm', 'manychat-alternative-india'],
  },
  {
    slug: 'instagram-dm-keywords-that-convert',
    title: 'Instagram Comment Keywords That Get Leads: 20 Ideas + DM Scripts',
    description: '20 comment trigger words for Instagram Reels, with the offer to send and a short DM script for each. Use them with free comment to DM automation.',
    h1: '20 comment keywords that turn Reel viewers into leads',
    kicker: 'Ideas and scripts',
    intro: 'The best trigger word is short, easy to type and tied to a clear offer. Here are keywords creators use, what to send for each, and a DM script you can copy.',
    sections: [
      { h2: 'Keywords for free resources', body: [
        { list: ['GUIDE: a PDF or checklist', 'TEMPLATE: a Canva or Notion template', 'LIST: a list of tools, books or places', 'PLAN: a workout, study or meal plan', 'FREE: a free class or sample'] },
        'DM script: "Hi! Here is the guide you asked for: [link]. If it helps, reply and tell me what you think."',
      ] },
      { h2: 'Keywords for selling', body: [
        { list: ['PRICE: your rate card or price list', 'COURSE: your course page', 'BOOK: a booking link for a call', 'OFFER: a limited-time discount', 'SHOP: your store or product page'] },
        'DM script: "Thanks for asking! Here are the details and prices: [link]. The offer ends on Sunday."',
      ] },
      { h2: 'Keywords for brands and leads', body: [
        { list: ['COLLAB: your brand-deal form or media kit', 'DEMO: a demo booking link', 'JOIN: your community or WhatsApp group', 'LIVE: the link to your next live class', 'NEWS: your newsletter sign-up'] },
      ] },
      { h2: 'Make the keyword work harder', body: [
        'Say it out loud in the video, write it on screen and in the caption, and use a different word per Reel. Send the DM to a page that captures an email or a payment, so the lead does not disappear.',
      ] },
    ],
    faq: [
      ['What makes a good trigger word?', 'It is short, easy to spell on a phone and clearly linked to what the person gets.'],
      ['Can I use Hindi words?', 'Yes. Any word or short phrase can be the trigger, in Hindi or English.'],
    ],
    related: ['how-to-set-up-comment-to-dm', 'instagram-comment-to-dm-automation', 'instagram-auto-reply-comments'],
  },
  {
    slug: 'manychat-alternative-india',
    title: 'ManyChat Alternative for Indian Creators: Free Comment to DM',
    description: 'Looking for a ManyChat alternative? Joinlyy gives Indian creators free Instagram comment to DM automation, a link in bio page, UPI selling and rupee pricing.',
    h1: 'A ManyChat alternative for Indian creators',
    kicker: 'Comparison',
    intro: 'If you only want comments to turn into DMs, you may not need a full chatbot platform. Joinlyy covers comment to DM automation together with your link in bio page and a way to sell, at no cost to start.',
    sections: [
      { h2: 'Where Joinlyy fits', body: [
        { list: ['Comment to DM automation is free on the Starter plan', 'A link in bio page and selling tools in the same account', 'UPI payments and WhatsApp alerts', 'Hindi and English, with prices in rupees', 'Creator ₹199 a month, Pro ₹399 a month, with two months free on yearly billing'] },
      ] },
      { h2: 'When a bigger chatbot tool is a better fit', body: [
        'If you need long multi-step chatbot flows across several messaging channels, a dedicated chatbot platform may suit you better. Joinlyy focuses on what most creators need first: turning comments into DMs, leads and sales.',
      ] },
      { h2: 'Try it without risk', body: [
        'The Starter plan is free with no card, so you can run a real Reel through it and compare the results.',
      ] },
    ],
    faq: [
      ['Is Joinlyy a chatbot platform?', 'Joinlyy focuses on comment to DM automation, follow-ups and lead capture for creators, not on complex multi-channel chatbots.'],
      ['Can I move my keywords over?', 'Yes. Create a new automation with the same trigger word and DM text.'],
    ],
    related: ['instagram-comment-to-dm-automation', 'how-to-set-up-comment-to-dm', 'free-link-in-bio'],
  },
  {
    slug: 'how-to-add-link-in-bio-instagram',
    title: 'How to Add a Link in Bio on Instagram (Step by Step)',
    description: 'How to add a link to your Instagram bio, and how to make that one link send people to your products, videos and offers. Free link in bio page for Indian creators.',
    h1: 'How to add a link in bio on Instagram',
    kicker: 'How-to guide',
    intro: 'Instagram gives you a place for links in your profile. Because it is limited, creators use one link that opens a page with everything: a link in bio page.',
    howto: { name: 'Add a link in bio on Instagram', steps: [
      ['Create your link in bio page', 'Sign up for Joinlyy, pick a template and add your links, products and offers. Publish your page.'],
      ['Copy your page link', 'Your link looks like joinlyy.com/yourname. Copy it from your dashboard.'],
      ['Open Edit profile on Instagram', 'In the Instagram app, go to your profile and tap Edit profile.'],
      ['Add the link', 'Open Links, choose Add external link and paste your page link. Save it.'],
      ['Tell people it is there', 'Say "link in bio" in your Reels and captions, and add a call to action such as "Comment GUIDE and I will DM it".'],
    ] },
    sections: [
      { h2: 'What to put on the page', body: [
        { list: ['Your best offer as the main button', 'Your latest video or Reel', 'Products, bookings or a lead form', 'Your social links and a short bio'] },
      ] },
      { h2: 'Use the same link everywhere', body: [
        'Your page link works on YouTube, WhatsApp, Telegram, LinkedIn and your business card too. Update the page once and every place stays up to date.',
      ] },
    ],
    faq: [
      ['Can I add more than one link on Instagram?', 'Instagram allows a limited number of links. A link in bio page lets you share as many as you like behind a single link.'],
      ['Is a link in bio page free?', 'Yes, the Starter plan is free, with 33 templates and free comment to DM automation.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'link-in-bio-ideas', 'link-in-bio-templates'],
  },
  {
    slug: 'link-in-bio-ideas',
    title: 'Link in Bio Ideas: What to Put on Your Page (by Creator Type)',
    description: 'What should go in your link in bio? Practical ideas for creators, coaches, fitness, food, travel, fashion and small businesses, with examples that earn.',
    h1: 'Link in bio ideas: what to put on your page',
    kicker: 'Ideas',
    intro: 'A good link in bio page has one clear main action and a few supporting links. Here is what works for different kinds of creators.',
    sections: [
      { h2: 'For every creator', body: [
        { list: ['One main button for your best offer, at the top', 'Your newest Reel or video', 'A lead form for your email or WhatsApp list', 'A brand-deal form and your media kit'] },
      ] },
      { h2: 'By niche', body: [
        { list: ['Fitness and wellness: your programme, a free plan, a booking link for consults', 'Food: your recipe ebook, weekly meal plan, the kitchen tools you use', 'Fashion and beauty: shoppable picks, a lookbook, a styling session', 'Travel: itineraries as PDFs, gear lists, a trip-planning call', 'Education: a free class, notes, a doubt-solving session', 'Business and coaching: a free call, case studies, your services page', 'Art and photography: your portfolio, prints or presets, a commission form'] },
      ] },
      { h2: 'Keep it simple', body: [
        'Five to seven items is enough. Put the thing that earns first and remove anything nobody clicks. Your analytics show which links work.',
      ] },
    ],
    faq: [
      ['How many links should I add?', 'Five to seven is a good start. Fewer choices means more clicks on the main one.'],
      ['What should the top button be?', 'Your best offer right now: a product, a free guide that grows your list, or a booking link.'],
    ],
    related: ['link-in-bio-for-indian-creators', 'link-in-bio-templates', 'how-to-add-link-in-bio-instagram'],
  },
  {
    slug: 'best-link-in-bio-tools-india',
    title: 'Best Link in Bio Tools for Indian Creators: What to Look For',
    description: 'How to choose a link in bio tool as an Indian creator: UPI payments, rupee pricing, Hindi support, Instagram automation, analytics and more. A simple checklist.',
    h1: 'Choosing a link in bio tool in India: what to look for',
    kicker: 'Buyer guide',
    intro: 'Many tools offer a link in bio page. These are the things that make the biggest difference for creators in India, so you can compare any tool, including Joinlyy, on what matters.',
    sections: [
      { h2: 'The checklist', body: [
        { list: ['Payments: can your followers pay by UPI, and who keeps the money?', 'Pricing in rupees: do you pay in INR, without surprise conversion fees?', 'Instagram automation: is comment to DM included, and at what price?', 'Language: does it work well in Hindi, including fonts?', 'WhatsApp: can you get alerts and share to WhatsApp easily?', 'Selling: digital products, calls, webinars, memberships', 'Analytics: views, clicks and sources, and for how long', 'Branding: can you remove the tool\'s logo, and on which plan?', 'Your data: can you export your leads?', 'Speed: does the page load fast on a mobile connection?'] },
      ] },
      { h2: 'Where Joinlyy stands', body: [
        'Joinlyy is built around these points: UPI payments, rupee prices, free comment to DM automation, Hindi and English, WhatsApp alerts, selling tools and lead export on paid plans. Starter is free, Creator is ₹199 a month and Pro is ₹399 a month.',
      ] },
      { h2: 'Try before you decide', body: [
        'Most tools have a free plan. Set up your page on two or three, share one with friends and see which one feels better to use.',
      ] },
    ],
    faq: [
      ['What matters most when picking a link in bio tool?', 'For most Indian creators: UPI payments, pricing in rupees, Instagram automation and a page that loads fast on mobile.'],
      ['Do I have to pay to start?', 'No. Joinlyy\'s Starter plan is free and includes comment to DM automation.'],
    ],
    related: ['linktree-alternative-india', 'free-link-in-bio', 'link-in-bio-for-indian-creators'],
  },
]
