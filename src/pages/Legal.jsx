import { useEffect } from 'react'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import { APP_NAME } from '../lib/config'

const UPDATED = '29 October 2026'

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
          <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-700 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
            {children}
          </div>
          <p className="mt-10 rounded-2xl bg-lilac-100 p-4 text-sm">
            This document is a starting template. Have it reviewed by a qualified lawyer before launch.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>{APP_NAME} (“we”) provides link-in-bio pages for creators. This policy explains what we collect, why, and the choices you have, in line with India’s Digital Personal Data Protection Act, 2023.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Creators:</b> name, email, login details, page content, and — if you connect it — Instagram profile data and permitted insights via Meta’s official API.</li>
        <li><b>Visitors:</b> anonymous analytics (page views, clicks, approximate device/browser type, referring site) linked to a random identifier stored on your device. We do not use third-party advertising cookies.</li>
        <li><b>Leads:</b> name, email and/or WhatsApp number you submit to a creator’s form, with the consent text you agreed to.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run your page and dashboard, show analytics and generate your media kit.</li>
        <li>To keep the platform safe — detecting scams, phishing and abuse.</li>
        <li>Lead data is shared only with the creator whose form you filled.</li>
      </ul>
      <h2>Your rights</h2>
      <p>You can access, correct, export and delete your data at any time from Settings → Your data. Visitors who submitted a lead form can ask the creator, or us, to delete their details.</p>
      <h2>Storage & security</h2>
      <p>Data is stored with Supabase (PostgreSQL) with row-level security; Instagram access tokens are stored server-side only and never exposed to browsers. Images and files are stored in Supabase Storage.</p>
      <h2>Contact</h2>
      <p>Grievance officer: privacy@yourbrand.in</p>
    </LegalShell>
  )
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>By creating a page on {APP_NAME} you agree to these terms.</p>
      <h2>Your page</h2>
      <ul>
        <li>You’re responsible for the content and links on your page.</li>
        <li>Don’t impersonate others, sell illegal goods, link to scams/phishing/malware, or post sexual content involving minors, hate or harassment.</li>
        <li>Disclose paid partnerships as required by ASCI guidelines.</li>
      </ul>
      <h2>Moderation</h2>
      <p>We may hide pages, disable links or suspend accounts that break these rules or the law, and we review visitor reports.</p>
      <h2>Instagram & third parties</h2>
      <p>Connecting Instagram is optional and subject to Meta’s Platform Terms. Webinars run in your own Zoom account; we only display your registration link.</p>
      <h2>Leads & messaging</h2>
      <p>Only contact people who gave consent through your form, and honour opt-out requests promptly. WhatsApp messaging must follow WhatsApp Business policies.</p>
      <h2>Liability</h2>
      <p>The service is provided “as is”. To the extent permitted by law, our liability is limited to the amount you paid us in the last 12 months.</p>
    </LegalShell>
  )
}
