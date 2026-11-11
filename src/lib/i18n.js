// Visitor-facing strings on creator pages (dashboard UI is English).
const STRINGS = {
  en: {
    share: 'Share',
    shareTitle: 'Share this page',
    copyLink: 'Copy link',
    copied: 'Copied!',
    scanQr: 'Scan to open on another phone',
    report: 'Report page',
    madeWith: 'Made with',
    createYours: 'Create your own',
    chat: 'Chat on WhatsApp',
    call: 'Call',
    register: 'Register',
    webinar: 'Live webinar',
    ended: 'Ended',
    name: 'Your name',
    email: 'Email',
    phone: 'WhatsApp number',
    submit: 'Subscribe',
    consent: 'I agree to be contacted by {name} on email/WhatsApp. I can unsubscribe anytime.',
    thanks: 'Thank you! You’re on the list.',
    notFound: 'This page doesn’t exist',
    notFoundHint: 'The username may have changed, or the page isn’t published yet.',
    claim: 'Claim this username',
    mediaKit: 'Media kit',
    play: 'Play video',
  },
  hi: {
    share: 'शेयर करें',
    shareTitle: 'यह पेज शेयर करें',
    copyLink: 'लिंक कॉपी करें',
    copied: 'कॉपी हो गया!',
    scanQr: 'दूसरे फ़ोन पर खोलने के लिए स्कैन करें',
    report: 'पेज रिपोर्ट करें',
    madeWith: 'बनाया गया',
    createYours: 'अपना पेज बनाएं',
    chat: 'WhatsApp पर बात करें',
    call: 'कॉल करें',
    register: 'रजिस्टर करें',
    webinar: 'लाइव वेबिनार',
    ended: 'समाप्त',
    name: 'आपका नाम',
    email: 'ईमेल',
    phone: 'WhatsApp नंबर',
    submit: 'जुड़ें',
    consent: 'मैं {name} से ईमेल/WhatsApp पर संपर्क के लिए सहमत हूँ। मैं कभी भी अनसब्सक्राइब कर सकता/सकती हूँ।',
    thanks: 'धन्यवाद! आप लिस्ट में जुड़ गए हैं।',
    notFound: 'यह पेज मौजूद नहीं है',
    notFoundHint: 'हो सकता है यूज़रनेम बदल गया हो या पेज अभी पब्लिश न हुआ हो।',
    claim: 'यह यूज़रनेम लें',
    mediaKit: 'मीडिया किट',
    play: 'वीडियो चलाएं',
  },
}

export function t(lang, key, vars) {
  let s = (STRINGS[lang] || STRINGS.en)[key] ?? STRINGS.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
  return s
}

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (Hindi)' },
]

export const NICHES = [
  'Fashion', 'Beauty', 'Fitness', 'Food', 'Travel', 'Education', 'Finance', 'Tech',
  'Comedy', 'Music', 'Dance', 'Gaming', 'Lifestyle', 'Parenting', 'Spirituality', 'Business', 'Other',
]
