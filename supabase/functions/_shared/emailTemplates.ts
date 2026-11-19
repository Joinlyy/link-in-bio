// Email layout and the text of each email. Plain HTML with inline styles so every mail app shows it properly.
const APP = (Deno.env.get('APP_ORIGIN') ?? 'https://www.joinlyy.com').replace(/\/$/, '')

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>')

export type Mail = { subject: string; html: string }

/** The shared look: logo, a card, one main button, a quiet footer */
function layout(opts: { preheader: string; title: string; body: string; button?: { label: string; url: string }; note?: string }): string {
  const button = opts.button
    ? `<p style="margin:28px 0 8px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#15161A;color:#D5F05C;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px">${esc(opts.button.label)}</a></p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#F2F1EC;font-family:Arial,Helvetica,sans-serif;color:#15161A">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F1EC;padding:28px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 16px"><a href="${APP}" style="text-decoration:none;color:#15161A;font-weight:800;font-size:20px"><img src="${APP}/logo.png" width="32" height="32" alt="" style="vertical-align:middle;border-radius:50%;margin-right:8px">Joinlyy</a></td></tr>
<tr><td style="background:#FFFFFF;border-radius:24px;padding:32px 28px">
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25">${esc(opts.title)}</h1>
<div style="font-size:16px;line-height:1.6;color:#2B2D33">${opts.body}</div>
${button}
${opts.note ? `<p style="margin:20px 0 0;font-size:13px;color:#6B6E78">${opts.note}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 8px;font-size:12px;color:#8A8D96;text-align:center">Joinlyy, the link in bio for Indian creators.<br><a href="${APP}" style="color:#8A8D96">joinlyy.com</a></td></tr>
</table></td></tr></table></body></html>`
}

export function welcome(name: string): Mail {
  return {
    subject: 'Welcome to Joinlyy: your link in bio is almost ready',
    html: layout({
      preheader: 'Three quick steps to get your page live.',
      title: `Welcome${name ? `, ${esc(name.split(' ')[0])}` : ''}!`,
      body: `<p>Your Joinlyy account is ready. Here is the fastest way to get value from it:</p>
<ol style="padding-left:20px;margin:12px 0">
<li style="margin-bottom:8px"><b>Pick a template</b> and add your links. It takes about ten minutes.</li>
<li style="margin-bottom:8px"><b>Connect Instagram</b> and set up free comment to DM automation: when someone comments a word on your Reel, they get your link in their DMs.</li>
<li><b>Share your link</b> in your Instagram, YouTube and WhatsApp bio.</li></ol>`,
      button: { label: 'Open my dashboard', url: `${APP}/dashboard` },
      note: 'Questions? Just reply to this email.',
    }),
  }
}

export function orderConfirmedBuyer(o: { creator: string; product: string; amount: number; orderUrl: string }): Mail {
  return {
    subject: `Your order from ${o.creator} is confirmed`,
    html: layout({
      preheader: `${o.product}, ${inr(o.amount)}`,
      title: 'Your order is confirmed',
      body: `<p>Thank you! Your payment to <b>${esc(o.creator)}</b> for <b>${esc(o.product)}</b> (${inr(o.amount)}) is confirmed.</p>
<p>Open your order page to get your download, booking or access. Keep this email: the link is your access to the order.</p>`,
      button: { label: 'Open my order', url: o.orderUrl },
      note: 'Something wrong? Use the support button on your order page and our team will help.',
    }),
  }
}

export function newOrderCreator(o: { buyer: string; product: string; amount: number }): Mail {
  return {
    subject: `New order: ${o.product} (${inr(o.amount)})`,
    html: layout({
      preheader: `${o.buyer} bought ${o.product}`,
      title: 'You have a new order',
      body: `<p><b>${esc(o.buyer)}</b> bought <b>${esc(o.product)}</b> for <b>${inr(o.amount)}</b>.</p>`,
      button: { label: 'See my sales', url: `${APP}/dashboard/sales` },
    }),
  }
}

export function paymentRejectedBuyer(o: { creator: string; product: string; orderUrl: string; reason?: string }): Mail {
  return {
    subject: `${o.creator} could not find your payment`,
    html: layout({
      preheader: 'Your order is not confirmed yet.',
      title: 'We could not confirm your payment',
      body: `<p><b>${esc(o.creator)}</b> could not find your UPI payment for <b>${esc(o.product)}</b>.</p>
${o.reason ? `<p>Their note: ${nl2br(o.reason)}</p>` : ''}
<p>If money left your account, open your order and send your UPI reference again, or use the support button and we will look into it.</p>`,
      button: { label: 'Open my order', url: o.orderUrl },
    }),
  }
}

export function planApproved(o: { plan: string; until: string | null }): Mail {
  return {
    subject: `Your ${o.plan} plan is active`,
    html: layout({
      preheader: 'Thanks for upgrading.',
      title: `Your ${o.plan} plan is active`,
      body: `<p>We confirmed your payment and switched your account to <b>${esc(o.plan)}</b>${o.until ? `, valid until <b>${esc(o.until)}</b>` : ''}. All the extra features are on now.</p>`,
      button: { label: 'Open my dashboard', url: `${APP}/dashboard` },
    }),
  }
}

export function planRejected(o: { plan: string; note?: string }): Mail {
  return {
    subject: 'We could not confirm your plan payment',
    html: layout({
      preheader: 'Your plan has not changed.',
      title: 'We could not confirm your payment',
      body: `<p>We could not match your payment for the <b>${esc(o.plan)}</b> plan, so your plan has not changed.</p>
${o.note ? `<p>Note from our team: ${nl2br(o.note)}</p>` : ''}
<p>Check the UPI reference and try again from your Billing page, or reply to this email if you need help.</p>`,
      button: { label: 'Open billing', url: `${APP}/dashboard/billing` },
    }),
  }
}

export function planExpiring(o: { plan: string; until: string; days: number }): Mail {
  return {
    subject: `Your ${o.plan} plan ends in ${o.days} day${o.days === 1 ? '' : 's'}`,
    html: layout({
      preheader: `Renew by ${o.until} to keep your features.`,
      title: `Your ${o.plan} plan ends on ${o.until}`,
      body: `<p>After that your account goes back to the free Starter plan. Extra automations, WhatsApp alerts and sales tools will pause.</p><p>Renew now and your plan continues without a gap.</p>`,
      button: { label: 'Renew my plan', url: `${APP}/dashboard/billing` },
    }),
  }
}

export function planExpired(o: { plan: string }): Mail {
  return {
    subject: `Your ${o.plan} plan has ended`,
    html: layout({
      preheader: 'You are back on the free plan.',
      title: 'Your plan has ended',
      body: `<p>Your <b>${esc(o.plan)}</b> plan has ended and your account is on the free Starter plan. Your page and content are safe, and free comment to DM automation keeps working.</p><p>You can upgrade again any time.</p>`,
      button: { label: 'See plans', url: `${APP}/dashboard/billing` },
    }),
  }
}

export function ticketReceived(o: { ticketNo: number; orderUrl: string }): Mail {
  return {
    subject: `We got your request #${o.ticketNo}`,
    html: layout({
      preheader: 'Our team will reply on your order page.',
      title: `We received your request #${o.ticketNo}`,
      body: `<p>Thanks for writing in. Our team will look into it and reply on your order page, and by email when you are done.</p>`,
      button: { label: 'Open my order', url: o.orderUrl },
    }),
  }
}

export function ticketReply(o: { reply: string; orderUrl: string; ticketNo: number }): Mail {
  return {
    subject: `Re: your support request #${o.ticketNo}`,
    html: layout({
      preheader: 'Our team replied to your request.',
      title: `Reply to your request #${o.ticketNo}`,
      body: `<p>${nl2br(o.reply)}</p>`,
      button: { label: 'Open my order', url: o.orderUrl },
    }),
  }
}
