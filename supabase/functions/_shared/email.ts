// Transactional email through Brevo (brevo.com, free plan available).
// Secrets: BREVO_API_KEY (an API key from Brevo, "SMTP & API" page), EMAIL_FROM (a sender address verified in Brevo,
// ideally on a domain with Brevo's SPF and DKIM records added), EMAIL_FROM_NAME (default "Joinlyy").
// Returns a short result for logs and the admin screen: "sent", "skipped: ..." or "failed: ...". Never throws.

export async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<string> {
  const key = Deno.env.get('BREVO_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!key || !from) return 'skipped: email is not set up'
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: Deno.env.get('EMAIL_FROM_NAME') ?? 'Joinlyy', email: from },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
      }),
    })
    if (res.ok) return 'sent'
    const body = await res.json().catch(() => ({}))
    return `failed: ${String(body.message || `HTTP ${res.status}`).slice(0, 140)}`
  } catch (e) {
    return `failed: ${String((e as Error)?.message || 'network error').slice(0, 100)}`
  }
}

/** Keeps a person in Brevo's contact list with their plan, so Brevo automations (welcome series, upgrade nudges) can use it.
 *  Needs BREVO_API_KEY; BREVO_LIST_ID is the list new creators join. Never throws. */
export async function syncContact(email: string, attributes: Record<string, string | number | boolean | null>): Promise<string> {
  const key = Deno.env.get('BREVO_API_KEY')
  if (!key) return 'skipped: email is not set up'
  const list = Number(Deno.env.get('BREVO_LIST_ID'))
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, attributes, updateEnabled: true, ...(list ? { listIds: [list] } : {}) }),
    })
    if (res.ok || res.status === 204) return 'synced'
    const body = await res.json().catch(() => ({}))
    return `failed: ${String(body.message || `HTTP ${res.status}`).slice(0, 140)}`
  } catch (e) {
    return `failed: ${String((e as Error)?.message || 'network error').slice(0, 100)}`
  }
}
