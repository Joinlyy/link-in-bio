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
    name: 'creator_upi_payment',
    text: 'A buyer, {{1}}, says they paid {{2}} for {{3}} by UPI with reference {{4}}. Please check your bank app, then confirm it at {{5}} so they get access.',
    example: ['Priya Sharma', '₹2,499', 'Instagram growth call', '412356789012', 'https://joinlyy.com/dashboard/sales'],
  },
  {
    name: 'creator_new_order',
    text: 'New order on your page: {{1}} bought {{2}} for {{3}}. You can see it at {{4}} anytime.',
    example: ['Priya Sharma', 'Instagram growth call', '₹2,499', 'https://joinlyy.com/dashboard/sales'],
  },
  {
    name: 'creator_new_lead',
    text: 'New lead on your page: {{1}} ({{2}}). See all your leads at {{3}} anytime.',
    example: ['Priya Sharma', 'priya@example.com', 'https://joinlyy.com/dashboard/leads'],
  },
  {
    name: 'creator_brand_enquiry',
    text: 'New brand enquiry from {{1}}: "{{2}}". Reply and track it at {{3}} in your dashboard.',
    example: ['Nykaa', 'We would love to work with you on our festive campaign', 'https://joinlyy.com/dashboard/deals'],
  },
  {
    name: 'buyer_order_confirmed',
    text: 'Good news: your payment to {{1}} for {{2}} is confirmed. Open your order at {{3}} to get access.',
    example: ['Ayush Kumar', 'Instagram growth call', 'https://joinlyy.com/order/abc123'],
  },
  {
    name: 'buyer_payment_rejected',
    text: 'Sorry, {{1}} could not find your payment for {{2}}. See their note at {{3}} and contact them with your UPI reference.',
    example: ['Ayush Kumar', 'Instagram growth call', 'https://joinlyy.com/order/abc123'],
  },
  {
    name: 'creator_alerts_on',
    text: 'WhatsApp alerts are on for your page. You will get messages here about new orders, UPI payments to confirm, leads and brand enquiries.',
    example: [],
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
