// Small inline icon set for brands and public pages (keeps lucide out of the public bundle).
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const I = (paths) =>
  function Icon({ size = 20, ...props }) {
    return (
      <svg {...base} width={size} height={size} {...props}>
        {paths}
      </svg>
    )
  }

export const InstagramIcon = I(
  <>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
  </>,
)
export const YoutubeIcon = I(
  <>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor" />
  </>,
)
export const XIcon = I(<path d="M4 4l16 16M20 4L4 20" />)
export const PencilIcon = I(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />)
const Solid = (d) => function SolidIcon({ size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}><path d={d} /></svg>
}
export const GithubIcon = Solid('M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12')
export const LeetcodeIcon = Solid('M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z')
export const FacebookIcon = I(<path d="M15 3.5h-2.2A3.8 3.8 0 009 7.3V10H6.5v3.4H9V21h3.4v-7.6h2.6l.5-3.4h-3.1V7.6c0-.6.4-1 1-1H15z" />)
export const LinkedinIcon = I(
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 10.5V16M8 7.6v.1M11.5 16v-3.2a2.2 2.2 0 014.4 0V16M11.5 10.5V16" />
  </>,
)
export const TelegramIcon = I(<path d="M21 4.5L3 11.4l5.6 2 2.1 6.1 3.2-3.8 4.6 3.4zM8.6 13.4L18 7.2l-7.3 8.2" />)
export const WhatsappIcon = I(
  <>
    <path d="M3.5 20.5l1.3-4.3A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.2-1.1z" />
    <path d="M9 8.8c0 3 2.4 6 5.6 6.4l1-1.2-1.6-1-.9.8c-1-.4-2-1.4-2.4-2.4l.8-.9-1-1.6z" fill="currentColor" strokeWidth="1" />
  </>,
)
export const SnapchatIcon = I(<path d="M12 3c3 0 5 2.2 5 5.3v2.3l1.8-.4c.5.6.2 1.2-1.6 1.8.6 1.7 1.8 2.9 3.3 3.4-.3.8-1.6 1-2.7 1.2l-.4 1.3-1.9-.2c-1 .3-1.9 1.6-3.5 1.6s-2.5-1.3-3.5-1.6l-1.9.2-.4-1.3c-1.1-.2-2.4-.4-2.7-1.2 1.5-.5 2.7-1.7 3.3-3.4-1.8-.6-2.1-1.2-1.6-1.8l1.8.4V8.3C7 5.2 9 3 12 3z" />)
export const SpotifyIcon = I(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M7.5 9.5c3-1 6.5-.8 9.2.7M8 12.6c2.5-.7 5.2-.5 7.4.7M8.6 15.4c1.9-.5 3.8-.3 5.4.5" />
  </>,
)
export const MailIcon = I(
  <>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M4 7l8 6 8-6" />
  </>,
)
export const LetterIcon = (letter) =>
  function Letter({ size = 20 }) {
    return (
      <svg {...base} width={size} height={size}>
        <circle cx="12" cy="12" r="9" />
        <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="DM Sans, sans-serif">
          {letter}
        </text>
      </svg>
    )
  }

export const SOCIAL_ICONS = {
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  x: XIcon,
  github: GithubIcon,
  leetcode: LeetcodeIcon,
  facebook: FacebookIcon,
  linkedin: LinkedinIcon,
  telegram: TelegramIcon,
  whatsapp: WhatsappIcon,
  snapchat: SnapchatIcon,
  spotify: SpotifyIcon,
  email: MailIcon,
  moj: LetterIcon('M'),
  josh: LetterIcon('J'),
  sharechat: LetterIcon('S'),
}

// Generic UI glyphs for public pages
export const ArrowUpRightIcon = I(<path d="M7 17L17 7M8 7h9v9" />)
export const ShareIcon = I(
  <>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
  </>,
)
export const CloseIcon = I(<path d="M6 6l12 12M18 6L6 18" />)
export const PhoneIcon = I(<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 006.5 6.5l1.5-2 4 1.5V19a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />)
export const CalendarIcon = I(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
)
export const PlayIcon = I(<path d="M8 5.5v13l11-6.5z" fill="currentColor" />)
export const FlagIcon = I(<path d="M5 21V4M5 4h11l-2 4 2 4H5" />)
export const CheckIcon = I(<path d="M5 12.5l4.5 4.5L19 7.5" />)

export function Logo({ size = 40, className = '' }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-full bg-ink text-lime ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M9.5 14.5l5-5M8.2 11.6l-1.4 1.4a3.5 3.5 0 005 5l1.4-1.4M15.8 12.4l1.4-1.4a3.5 3.5 0 00-5-5l-1.4 1.4" />
      </svg>
    </span>
  )
}
