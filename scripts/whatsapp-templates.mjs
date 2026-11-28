// Creates the WhatsApp message templates the `whatsapp` function sends. Run once, then wait for
// Meta's approval (usually minutes). Safe to re-run: existing templates are reported, not duplicated.
// Usage (PowerShell):  $env:WHATSAPP_TOKEN="…"; $env:WHATSAPP_WABA_ID="…"; node scripts/whatsapp-templates.mjs
// Usage (bash):        WHATSAPP_TOKEN=… WHATSAPP_WABA_ID=… node scripts/whatsapp-templates.mjs
// Parameter order must match supabase/functions/whatsapp/index.ts.

const TOKEN = process.env.WHATSAPP_TOKEN
const WABA = process.env.WHATSAPP_WABA_ID
if (!TOKEN || !WABA) {
  console.error('Set WHATSAPP_TOKEN and WHATSAPP_WABA_ID first (WhatsApp Manager → Account tools → WhatsApp Business Account ID).')
  process.exit(1)
}

const TEMPLATES = [
  {
    name: 'creator_new_order',
    text: 'New order on your page: {{1}} bought {{2}} for {{3}}. You can see it at {{4}} anytime.',
    example: ['Priya Sharma', 'Instagram growth call', '₹2,499', 'https://joinlyy.com/dashboard/sales'],
  },
  {
    name: 'creator_new_contact',
    text: 'New {{1}} received on your page from {{2}}: "{{3}}". Reply and track it at {{4}} in your dashboard.',
    example: ['lead', 'Priya Sharma', 'priya@example.com', 'https://joinlyy.com/dashboard/leads'],
  },
  {
    name: 'admin_support_ticket',
    text: 'New support request #{{1}}: {{2}}, from {{3}}. Open it in your admin at {{4}} to reply.',
    example: ['12', 'Payment failed or pending', 'priya@example.com', 'https://joinlyy.com/admin/support'],
  },
  {
    name: 'creator_post_status',
    text: 'Your scheduled Instagram post for {{1}} {{2}}. {{3}} You can review it at {{4}}.',
    example: ['28 Nov, 7:00 pm IST', 'was published successfully', 'It is now live on your Instagram profile.', 'https://joinlyy.com/dashboard/schedule'],
  },
]

const GRAPH = 'https://graph.facebook.com/v21.0'
const existing = await fetch(`${GRAPH}/${WABA}/message_templates?fields=name,status&limit=200`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json())
if (existing.error) {
  console.error('Could not read templates:', existing.error.message)
  process.exit(1)
}
const have = new Map((existing.data || []).map((t) => [t.name, t.status]))

for (const t of TEMPLATES) {
  if (have.has(t.name)) {
    console.log(`${t.name}: already exists (${have.get(t.name)})`)
    continue
  }
  const body = {
    name: t.name,
    category: 'UTILITY',
    language: 'en',
    components: [{ type: 'BODY', text: t.text, ...(t.example.length ? { example: { body_text: [t.example] } } : {}) }],
  }
  const res = await fetch(`${GRAPH}/${WABA}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json())
  console.log(`${t.name}: ${res.error ? `failed: ${res.error.error_user_msg || res.error.message}` : `submitted (${res.status || 'PENDING'})`}`)
}
