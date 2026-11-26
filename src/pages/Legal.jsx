import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchDeletionStatus } from '../lib/publicApi'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { APP_NAME } from '../lib/config'

const UPDATED = '26 November 2026'
const CONTACT = 'support@joinlyy.com'
const OFFICER = 'Ayush Pawar'
const ADDRESS = 'Indirapuram, Ghaziabad, Uttar Pradesh, India'

const mail = (subject = '') => (
  <a href={`mailto:${CONTACT}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`} className="underline">{CONTACT}</a>
)

function LegalShell({ title, children }) {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`
    window.scrollTo(0, 0)
  }, [title])
  return (
    <>
      <SiteHeader />
      <main className="container-page mt-4">
        <article className="card mx-auto max-w-3xl p-6 sm:p-12">
          <p className="eyebrow text-ink-500">Last updated {UPDATED}</p>
          <h1 className="display-lg mt-3">{title}</h1>
          <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-700 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}

/** Who we are, repeated at the end of every legal page */
function CompanyBlock() {
  return (
    <>
      <h2>Who we are and how to reach us</h2>
      <p>
        {APP_NAME} is operated from {ADDRESS}. Chief Executive Officer and Grievance Officer: <b>{OFFICER}</b>.
        Email: {mail()}. We acknowledge every complaint within 24 hours and aim to resolve it within 15 days.
      </p>
    </>
  )
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy explains what personal data {APP_NAME} (“we”, “us”) collects, why, who sees it, how long we keep it and the choices you have.
        It follows India’s Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000 and its rules. {APP_NAME} is a service for creators; it is not meant for children under 18.
      </p>

      <h2>Who is responsible for your data</h2>
      <p>
        For creators’ accounts and for visitors’ analytics, {APP_NAME} decides why and how data is used. For the details a buyer or a lead gives to a creator (for example an email on a lead form),
        the creator and {APP_NAME} each use it for their own purpose described below. Our contact details are at the end of this page.
      </p>

      <h2>What we collect</h2>
      <h3>Creators</h3>
      <ul>
        <li><b>Account:</b> name, email address, password (stored only as a salted hash) or Google sign-in, plan, language and settings.</li>
        <li><b>Page content:</b> everything you put on your page: text, images, links, products, files, prices, bookings, forms and your media kit.</li>
        <li><b>Payout details:</b> the UPI ID and account name you give us so we can send your earnings, your earnings and payout history, and the payment reference of each payout. If payouts through a payment partner are switched on, your PAN, address and bank details are sent straight to that partner for verification; we keep only your name, the last four digits of the account and the verification status.</li>
        <li><b>Plan billing:</b> the plan you bought, amounts, GST, dates and payment reference. Your card, UPI or bank details are entered on Razorpay’s payment window and are never stored by us.</li>
        <li><b>Instagram, if you connect it:</b> your profile (username, name, bio, picture, account type, follower and post counts), recent posts with likes and comments counts, account reach, and an access token. We store the token on the server only.</li>
        <li><b>Posts you schedule:</b> the photos or video you upload, the caption and the time. The files are deleted from our storage as soon as the post is published, and in any case within about 12 hours unless the post is still waiting to go out. We keep the post’s link, time, caption and status.</li>
        <li><b>Team and support:</b> invited team members’ emails and roles, and messages you send to our support.</li>
      </ul>
      <h3>Buyers and leads</h3>
      <ul>
        <li><b>Orders:</b> name, email, optional phone number, the product, amount, coupon, any note or question, the time and the payment reference. This is shared with the creator you bought from so they can deliver, support you and keep their records.</li>
        <li><b>Leads:</b> name, email and/or WhatsApp number you submit to a creator’s form, with the consent wording you agreed to.</li>
        <li><b>Support requests:</b> what you write on an order page or send to {mail()}, including any screenshot you attach.</li>
      </ul>
      <h3>Visitors</h3>
      <ul>
        <li>Anonymous page analytics: page views, link clicks, approximate device, browser and region, referring site, and a random identifier kept on your device. We do not sell it and we do not use advertising cookies of our own.</li>
        <li>Creators can add their own Meta Pixel, Google Analytics or UTM tracking to their page. That tracking belongs to the creator, who must tell you about it.</li>
      </ul>
      <h3>Instagram automations</h3>
      <p>
        When a creator turns on DM automation, Instagram sends us the comments and messages that people send to that creator’s account (Instagram username and the text), so we can send the automatic reply and show it in the creator’s activity log.
        If someone replies with an email or phone number, it is saved as a lead for that creator. We only message people who commented or messaged first, as Instagram’s rules require.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To provide the service: your page, dashboard, orders, bookings, downloads, analytics, media kit, scheduled posts and automations.</li>
        <li>To take payments, deliver purchases, send creators their earnings and handle refunds and disputes.</li>
        <li>To send service emails and, if you opt in, WhatsApp messages: sign-in and password emails, order and payment receipts, plan renewal reminders, payout notices and support replies.</li>
        <li>To keep the platform safe: detecting scams, phishing, fraud and abuse, and enforcing our Terms.</li>
        <li>To meet legal duties: tax, accounting and responding to lawful requests.</li>
      </ul>
      <p>We do not sell personal data and we do not use it to show third-party advertising.</p>

      <h2>Who else handles your data</h2>
      <p>We use these service providers, only for the purposes above and under their own privacy terms:</p>
      <ul>
        <li><b>Supabase</b>: database, sign-in and file storage.</li>
        <li><b>Vercel</b>: hosting of the website.</li>
        <li><b>Razorpay</b>: payments for plans and for creators’ products, refunds and (if switched on) payout verification.</li>
        <li><b>Meta (Instagram and WhatsApp)</b>: connecting Instagram, publishing posts, DM automation and WhatsApp alerts.</li>
        <li><b>Google</b>: optional Google sign-in, and Safe Browsing to check links for scams.</li>
        <li><b>Brevo</b>: sending our emails.</li>
      </ul>
      <p>
        Some of these providers run servers outside India, so your data may be processed outside India. We choose providers that protect data with industry-standard safeguards.
        We may also disclose data when the law requires it, to protect our users, or in a sale or merger of the business (you will be told).
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and page data: while your account is open, and deleted within 30 days after you delete your account.</li>
        <li>Instagram data: until you disconnect, when it is deleted straight away.</li>
        <li>Uploaded files for scheduled posts: deleted after publishing, or within about 12 hours when not needed.</li>
        <li>Orders, payments, invoices and payout records: for as long as Indian tax and accounting law requires, even if you delete your account.</li>
        <li>Support messages and email logs: up to 180 days, unless a dispute needs them longer.</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under the Digital Personal Data Protection Act you can:</p>
      <ul>
        <li>ask what personal data of yours we hold and how we use it;</li>
        <li>correct or complete it, and ask us to erase it (we cannot erase records the law makes us keep);</li>
        <li>withdraw consent you gave, for example for marketing or WhatsApp messages, at any time;</li>
        <li>nominate someone to exercise these rights for you if you die or cannot act;</li>
        <li>complain to us, and, if we do not resolve it, to the Data Protection Board of India.</li>
      </ul>
      <p>
        Creators can access, correct, export and delete their data in <b>Settings → Your data</b>. Everyone else can email {mail('Privacy request')} from the email address concerned.
        We may ask you to confirm it is you. We reply within 30 days, usually sooner. Because a creator is responsible for the buyers and leads on their own page, a buyer or lead can also ask that creator directly.
      </p>

      <h2 id="data-deletion">Deleting your Instagram data</h2>
      <p>You can remove our access to Instagram and delete the Instagram data we hold at any time, in any of these ways:</p>
      <ul>
        <li>In your dashboard, go to <b>Settings → Instagram → Disconnect</b>. We delete your Instagram access token and profile data straight away.</li>
        <li>In the Instagram app, go to <b>Settings → Website permissions → Apps and websites</b>, remove {APP_NAME} and choose to delete your data. Meta notifies us and we delete your token, profile data and DM automation history. You get a confirmation code you can check at <a href="/data-deletion" className="underline">{typeof window === 'undefined' ? '' : window.location.host}/data-deletion</a>.</li>
        <li>Delete your whole account from <b>Settings → Your data</b>, or email {mail('Delete my data')} and we will delete it within 30 days.</li>
      </ul>

      <h2>Cookies and similar storage</h2>
      <p>
        We use browser storage that the service needs to work: to keep you signed in, remember small settings and keep a random visitor identifier for anonymous analytics.
        You can clear it in your browser; you will then be signed out. We ask for your consent before any non-essential tracking we control.
      </p>

      <h2>Security</h2>
      <p>
        Data is stored in a database with row-level security, so a creator can only reach their own data. Passwords are hashed, Instagram tokens stay on the server, connections use HTTPS, payment details never touch our servers
        and our admin tools are limited to authorised staff and keep an audit log. No system is perfectly secure. If a breach affects your personal data we will tell you and the authorities as the law requires.
      </p>

      <h2>Children</h2>
      <p>{APP_NAME} is for people aged 18 and over. We do not knowingly collect data from children. If you think a child has given us data, email {mail()} and we will delete it.</p>

      <h2>Changes</h2>
      <p>We will update this page when our practices change and show the date at the top. For important changes we will also tell creators by email or in the dashboard.</p>

      <p>See also our <a href="/terms" className="underline">Terms of Service</a> and <a href="/refund-policy" className="underline">Refund Policy</a>.</p>
      <CompanyBlock />
    </LegalShell>
  )
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These terms are the agreement between you and {APP_NAME}, operated from {ADDRESS}. By creating an account or using a {APP_NAME} page you agree to them, to our <a href="/privacy" className="underline">Privacy Policy</a> and to our <a href="/refund-policy" className="underline">Refund Policy</a>.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 and able to enter a contract in India. Give correct details and keep your password safe; you are responsible for what happens in your account.</li>
        <li>One person or business may not run accounts to get around limits or bans.</li>
      </ul>

      <h2>Your page and content</h2>
      <ul>
        <li>You are responsible for everything on your page: content, links, products, prices and promises to buyers.</li>
        <li>You keep your rights in your content. You give us a licence to host, display and deliver it so the service can work.</li>
        <li>Don’t impersonate others, sell illegal or counterfeit goods, link to scams, phishing or malware, post sexual content involving minors, hate or harassment, or infringe anyone’s rights.</li>
        <li>Disclose paid partnerships as required by ASCI guidelines.</li>
      </ul>

      <h2>Plans, billing and autopay</h2>
      <ul>
        <li>The Starter plan is free. Creator and Pro are paid. Prices are shown before 18% GST, which is added at checkout.</li>
        <li>Paid plans renew automatically (autopay) through Razorpay for the period you chose, until you turn auto-renew off in <b>Dashboard → Plan</b>. If you turn it off, your plan stays until the end of the period you paid for.</li>
        <li>We remind you before a plan ends. If a renewal payment fails, we do not give a grace period; your plan ends on its end date and you move to Starter.</li>
        <li>Refunds of plan fees are covered in the <a href="/refund-policy" className="underline">Refund Policy</a>.</li>
        <li>We may change plan prices or limits. Changes apply from your next renewal and we will tell you first.</li>
      </ul>

      <h2>Selling on {APP_NAME}</h2>
      <ul>
        <li>Buyers pay at {APP_NAME} checkout. We take a platform charge on each sale (15% on Starter, 10% on Creator, 5% on Pro, as shown on the pricing page) and send the rest, your earning, to the UPI ID you gave us within 2 working days of the sale. We may hold or delay a payout while we check a dispute, a refund request or suspected fraud.</li>
        <li>The price you set is what the buyer pays. We add nothing on top, so include GST in your price if it applies to you.</li>
        <li>You are responsible for your own taxes: GST, income tax, TDS and invoices. {APP_NAME} may report sales and payouts where the law requires.</li>
        <li>You must deliver what you sell as described. Refunds to buyers follow the <a href="/refund-policy" className="underline">Refund Policy</a>; an approved refund is taken back from your earnings, including a payout we have already sent.</li>
        <li>You must give a UPI ID that belongs to you. We are not responsible for money sent to a wrong ID you gave us.</li>
        <li>Brand products and courses you list with an outside link are sold on that site, not by {APP_NAME}.</li>
      </ul>

      <h2>Instagram and other connections</h2>
      <ul>
        <li>Connecting Instagram is optional and subject to Meta’s Platform Terms and Instagram’s policies. You must have the right to post what you upload.</li>
        <li>The post scheduler publishes only what you upload, to the account you connect, at the time you choose. Daily and monthly limits depend on your plan. We are not responsible if Instagram refuses, delays or removes a post.</li>
        <li>DM automations may only message people who commented or messaged first, within Instagram’s rules. WhatsApp messaging must follow WhatsApp Business policies.</li>
        <li>Webinars run in your own Zoom account; we only show your registration link.</li>
      </ul>

      <h2>Leads and messaging</h2>
      <p>Only contact people who gave consent through your form, and honour opt-out requests promptly.</p>

      <h2>Moderation and suspension</h2>
      <p>We may hide pages, disable links, hold payouts or suspend accounts that break these terms or the law, and we review visitor reports. You can delete your account at any time from Settings.</p>

      <h2>Our service</h2>
      <p>We work to keep {APP_NAME} available but it is provided “as is”, and we do not promise it will be uninterrupted or error free. Features may change.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, we are not liable for indirect or consequential loss, lost profits or lost data, and our total liability to you is limited to the amount you paid us in fees in the last 12 months. Nothing here limits liability that cannot be limited by law.</p>

      <h2>Law and disputes</h2>
      <p>These terms are governed by the laws of India. Please write to us first at {mail()} so we can try to fix it. If we cannot, the courts at Ghaziabad, Uttar Pradesh have jurisdiction.</p>

      <h2>Changes</h2>
      <p>We may update these terms. We will show the new date here and, for important changes, tell you by email or in the dashboard. Using {APP_NAME} after a change means you accept it.</p>
      <CompanyBlock />
    </LegalShell>
  )
}

export function RefundPolicy() {
  return (
    <LegalShell title="Refund Policy">
      <p>
        This policy covers refunds for things bought on {APP_NAME}: products bought from a creator, and {APP_NAME} plans. Creators set their own products and prices; {APP_NAME} handles the payment and the refund.
      </p>

      <h2>How to ask for a refund</h2>
      <p>Email {mail('Refund request')} from the email address you used to buy, and include all of this so we can act quickly:</p>
      <ul>
        <li>The <b>creator’s name</b> (or page link) you bought from.</li>
        <li>The <b>product</b> you bought.</li>
        <li>A <b>screenshot of your payment</b>, showing the amount, date and transaction ID or UTR.</li>
        <li>A short note on what went wrong.</li>
      </ul>
      <p>Ask within <b>7 days</b> of the purchase. You can also press the support button on your order page. Requests that miss any of the items above may take longer.</p>

      <h2>What happens next</h2>
      <ul>
        <li>We reply within 2 working days and may ask the creator for their side.</li>
        <li>We decide within 7 working days of having everything we need.</li>
        <li>If a refund is approved, it goes back to the <b>original payment method</b> and reaches you in about 5 to 7 working days, depending on your bank.</li>
      </ul>

      <h2>When we refund a purchase</h2>
      <ul>
        <li>You were charged but did not get access to the product.</li>
        <li>You were charged more than once for the same order.</li>
        <li>The product is materially different from how it was described.</li>
        <li>A paid session, call or webinar was cancelled or not held and was not rescheduled to a time that suits you.</li>
        <li>The creator agrees to a refund.</li>
      </ul>

      <h2>When we usually do not</h2>
      <ul>
        <li>Digital products you have already downloaded or used, if they match their description.</li>
        <li>You changed your mind, or the product was not what you hoped for but matches its description.</li>
        <li>Sessions you missed without telling the creator in time.</li>
        <li>Requests made after the 7 days, unless the product could not be delivered.</li>
      </ul>

      <h2>Money taken but the order failed</h2>
      <p>If money left your account but the order shows as not paid, banks usually reverse it automatically in 5 to 7 working days. If it does not come back, email us with the payment screenshot and we will trace it with the payment partner.</p>

      <h2>{APP_NAME} plans</h2>
      <ul>
        <li>You can turn auto-renew off at any time in <b>Dashboard → Plan</b>. The plan then stays active until the end of the period you already paid for.</li>
        <li>Plan fees for a period already started are not refunded, except when we charged you twice or charged you wrongly. Email {mail('Plan refund')} with the payment screenshot and we will fix it.</li>
      </ul>

      <h2>Chargebacks</h2>
      <p>Please write to us before raising a dispute with your bank, because we can usually solve it faster. An approved refund is taken back from the creator’s earnings.</p>

      <p>See also our <a href="/terms" className="underline">Terms of Service</a> and <a href="/privacy" className="underline">Privacy Policy</a>.</p>
      <CompanyBlock />
    </LegalShell>
  )
}

/** Where Meta sends people after an Instagram data deletion request: /data-deletion?code=… */
export function DataDeletion() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') || '')
  const [state, setState] = useState(null) // null | 'loading' | result | 'missing'

  async function check(c = code) {
    if (!c.trim()) return
    setState('loading')
    try {
      const r = await fetchDeletionStatus(c.trim())
      setState(r || 'missing')
    } catch {
      setState('missing')
    }
  }
  useEffect(() => {
    const c = params.get('code')
    if (c) check(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const when = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <LegalShell title="Data deletion">
      <p>When you remove {APP_NAME} from Instagram and ask for your data to be deleted, Meta gives you a confirmation code. Enter it here to see the status.</p>
      <form onSubmit={(e) => { e.preventDefault(); check() }} className="flex flex-wrap gap-2">
        <input className="field h-12 min-w-0 flex-1" placeholder="Confirmation code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Confirmation code" />
        <button type="submit" className="h-12 rounded-full bg-ink px-6 text-sm font-semibold text-white">Check</button>
      </form>
      {state === 'loading' && <p>Checking…</p>}
      {state === 'missing' && <p className="rounded-2xl bg-red-50 p-4 text-red-700">We couldn’t find that code. Check it and try again, or email <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.</p>}
      {state && typeof state === 'object' && (
        <p className="rounded-2xl bg-lime-200 p-4">
          {state.status === 'complete'
            ? <>Done. Request <b>{state.code}</b> was received on {when(state.requested_at)} and your Instagram data was deleted on {when(state.completed_at)}.</>
            : <>Request <b>{state.code}</b> was received on {when(state.requested_at)} and is being processed.</>}
        </p>
      )}
      <p>See our <a href="/privacy#data-deletion" className="underline">privacy policy</a> for the other ways to delete your data.</p>
    </LegalShell>
  )
}
