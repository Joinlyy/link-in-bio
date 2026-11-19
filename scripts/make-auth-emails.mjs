// Builds the branded Supabase sign-in email templates into docs/auth-email-templates/.
// Paste each file into Supabase: Authentication, Email Templates (subject and body).
// Run: node scripts/make-auth-emails.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = 'https://www.joinlyy.com'

// One shared look: logo, white card, one dark button, quiet footer. Supabase fills in the {{ ... }} variables.
const layout = ({ preheader, title, body, button, note }) => `<!doctype html>
<html><body style="margin:0;background:#F2F1EC;font-family:Arial,Helvetica,sans-serif;color:#15161A">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F1EC;padding:28px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 16px"><a href="${SITE}" style="text-decoration:none;color:#15161A;font-weight:800;font-size:20px"><img src="${SITE}/logo.png" width="32" height="32" alt="" style="vertical-align:middle;border-radius:50%;margin-right:8px">Joinlyy</a></td></tr>
<tr><td style="background:#FFFFFF;border-radius:24px;padding:32px 28px">
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25">${title}</h1>
<div style="font-size:16px;line-height:1.6;color:#2B2D33">${body}</div>
${button ? `<p style="margin:28px 0 8px"><a href="${button.url}" style="display:inline-block;background:#15161A;color:#D5F05C;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px">${button.label}</a></p>` : ''}
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6B6E78">${note}</p>
</td></tr>
<tr><td style="padding:16px 8px;font-size:12px;color:#8A8D96;text-align:center">Joinlyy, the link in bio for Indian creators.<br><a href="${SITE}" style="color:#8A8D96">joinlyy.com</a></td></tr>
</table></td></tr></table></body></html>
`

const ignore = 'If you did not ask for this, you can ignore this email. Nothing will change.'
const linkFallback = 'Button not working? Copy this link into your browser:<br><span style="word-break:break-all">{{ .ConfirmationURL }}</span>'

const templates = {
  'confirm-signup': {
    subject: 'Confirm your Joinlyy account',
    where: 'Confirm sign up',
    html: layout({
      preheader: 'One tap to confirm your email.',
      title: 'Confirm your email',
      body: '<p>Welcome to Joinlyy! Confirm that <b>{{ .Email }}</b> is your email address to finish creating your account.</p>',
      button: { label: 'Confirm my email', url: '{{ .ConfirmationURL }}' },
      note: `${ignore}<br><br>${linkFallback}`,
    }),
  },
  'magic-link': {
    subject: 'Your Joinlyy sign-in link',
    where: 'Magic link',
    html: layout({
      preheader: 'Tap to sign in. The link works once.',
      title: 'Sign in to Joinlyy',
      body: '<p>Tap the button to sign in as <b>{{ .Email }}</b>. The link works once and expires in 1 hour.</p>',
      button: { label: 'Sign in', url: '{{ .ConfirmationURL }}' },
      note: `${ignore} Never forward this email: anyone with the link can sign in.<br><br>${linkFallback}`,
    }),
  },
  'reset-password': {
    subject: 'Reset your Joinlyy password',
    where: 'Reset password',
    html: layout({
      preheader: 'Choose a new password for your account.',
      title: 'Reset your password',
      body: '<p>We got a request to reset the password for <b>{{ .Email }}</b>. Tap the button to choose a new one. The link works once and expires in 1 hour.</p>',
      button: { label: 'Choose a new password', url: '{{ .ConfirmationURL }}' },
      note: `${ignore} Your current password stays the same.<br><br>${linkFallback}`,
    }),
  },
  'change-email': {
    subject: 'Confirm your new email for Joinlyy',
    where: 'Change email address',
    html: layout({
      preheader: 'Confirm the new email address for your account.',
      title: 'Confirm your new email',
      body: '<p>You asked to change the email on your Joinlyy account from <b>{{ .Email }}</b> to <b>{{ .NewEmail }}</b>. Confirm to finish the change.</p>',
      button: { label: 'Confirm new email', url: '{{ .ConfirmationURL }}' },
      note: `${ignore}<br><br>${linkFallback}`,
    }),
  },
  invite: {
    subject: 'You have been invited to Joinlyy',
    where: 'Invite user',
    html: layout({
      preheader: 'Accept your invitation to join.',
      title: 'You are invited to Joinlyy',
      body: '<p>You have been invited to create an account on Joinlyy, the link in bio for Indian creators. Accept the invitation to get started.</p>',
      button: { label: 'Accept invitation', url: '{{ .ConfirmationURL }}' },
      note: `If you were not expecting this invitation, you can ignore this email.<br><br>${linkFallback}`,
    }),
  },
  reauthentication: {
    subject: 'Your Joinlyy confirmation code',
    where: 'Reauthentication',
    html: layout({
      preheader: 'Use this code to confirm it is you.',
      title: 'Your confirmation code',
      body: '<p>Enter this code to confirm it is you:</p><p style="margin:16px 0;font-size:32px;font-weight:800;letter-spacing:6px;color:#15161A">{{ .Token }}</p>',
      note: 'The code expires soon and works once. If you did not ask for it, ignore this email and consider changing your password.',
    }),
  },
}

mkdirSync('docs/auth-email-templates', { recursive: true })
let readme = `# Supabase sign-in email templates (Joinlyy look)\n\nIn the Supabase dashboard open **Authentication, then Email Templates**. For each row below, open that template, paste the **subject** and replace the **body** with the file's HTML, then save.\nRegenerate with \`node scripts/make-auth-emails.mjs\`.\n\n| Supabase template | Subject | File |\n| --- | --- | --- |\n`
for (const [file, t] of Object.entries(templates)) {
  writeFileSync(`docs/auth-email-templates/${file}.html`, t.html)
  readme += `| ${t.where} | ${t.subject} | \`${file}.html\` |\n`
}
writeFileSync('docs/auth-email-templates/README.md', readme)
console.log(`wrote ${Object.keys(templates).length} templates`)
