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

export function newContactCreator(o: { kind: 'lead' | 'brand enquiry'; who: string; detail: string; url: string }): Mail {
  const lead = o.kind === 'lead'
  return {
    subject: lead ? `New lead: ${o.who}` : `New brand enquiry from ${o.who}`,
    html: layout({
      preheader: lead ? `${o.who} joined your list` : `${o.who} sent a brand enquiry`,
      title: lead ? 'You have a new lead' : 'You have a new brand enquiry',
      body: lead
        ? `<p><b>${esc(o.who)}</b> shared their details through your page.</p><p>${esc(o.detail)}</p>`
        : `<p><b>${esc(o.who)}</b> sent you a brand enquiry.</p><p>${nl2br(o.detail)}</p>`,
      button: { label: lead ? 'See my leads' : 'Open my deals', url: o.url },
    }),
  }
}

export function postStatusCreator(o: { ok: boolean; when: string; reason?: string | null; url: string }): Mail {
  return {
    subject: o.ok ? 'Your Instagram post is live' : 'Your Instagram post could not be published',
    html: layout({
      preheader: o.ok ? `The post scheduled for ${o.when} is live.` : `The post scheduled for ${o.when} did not go out.`,
      title: o.ok ? 'Your scheduled post is live' : 'Your scheduled post did not go out',
      body: o.ok
        ? `<p>The post you scheduled for <b>${esc(o.when)}</b> was published on your Instagram profile.</p>`
        : `<p>The post you scheduled for <b>${esc(o.when)}</b> could not be published.</p>${o.reason ? `<p>Reason: ${nl2br(o.reason)}</p>` : ''}<p>Open it to fix the problem and publish it again.</p>`,
      button: { label: 'Open my scheduled posts', url: o.url },
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

// ---- Razorpay subscriptions ----
const inr2 = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function subscriptionReceipt(o: { plan: string; period: string; base: number; gst: number; total: number; until: string | null; paymentId: string; method?: string | null }): Mail {
  return {
    subject: `Payment received: your ${o.plan} plan is active`,
    html: layout({
      preheader: `${inr2(o.total)} received. Thank you!`,
      title: `Your ${o.plan} plan is active`,
      body: `<p>Thank you! We received your payment and your <b>${esc(o.plan)}</b> plan (${o.period === 'year' ? 'yearly' : o.period === 'test' ? 'Rs 1 test' : 'monthly'}) is on${o.until ? ` until <b>${esc(o.until)}</b>` : ''}.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:15px;border-top:1px solid #ECEAE3">
<tr><td style="padding:10px 0;border-bottom:1px solid #ECEAE3">${esc(o.plan)} plan</td><td align="right" style="padding:10px 0;border-bottom:1px solid #ECEAE3">${inr2(o.base)}</td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #ECEAE3">GST (18%)</td><td align="right" style="padding:10px 0;border-bottom:1px solid #ECEAE3">${inr2(o.gst)}</td></tr>
<tr><td style="padding:10px 0"><b>Total paid</b></td><td align="right" style="padding:10px 0"><b>${inr2(o.total)}</b></td></tr></table>
<p style="font-size:13px;color:#6B6E78">Payment ID: ${esc(o.paymentId)}${o.method ? `, paid by ${esc(o.method)}` : ''}. Your plan renews automatically; you can turn auto-renew off any time on the Billing page.</p>`,
      button: { label: 'Open my dashboard', url: `${APP}/dashboard` },
    }),
  }
}

export function renewalFailed(o: { plan: string; total: number; reason?: string | null }): Mail {
  return {
    subject: `Your ${o.plan} payment did not go through`,
    html: layout({
      preheader: 'Your plan has not been renewed yet.',
      title: 'Your payment did not go through',
      body: `<p>We tried to charge <b>${inr2(o.total)}</b> for your <b>${esc(o.plan)}</b> plan, but the payment failed${o.reason ? ` (${esc(o.reason)})` : ''}.</p>
<p>Your plan stays on until its current end date. Please check that your card or UPI has enough balance, or pay again from the Billing page, so you don't lose your paid features.</p>`,
      button: { label: 'Fix my payment', url: `${APP}/dashboard/billing` },
    }),
  }
}

export function payoutSent(o: { amount: number; upi: string | null; reference: string | null }): Mail {
  const amt = `₹${o.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return {
    subject: `We sent you ${amt}`,
    html: layout({
      preheader: `${amt} is on its way to your UPI ID.`,
      title: 'Your payout is on its way',
      body: `<p>We sent <b>${esc(amt)}</b>, your share of recent sales, ${o.upi ? `to your UPI ID <b>${esc(o.upi)}</b>` : 'to you'}.</p>${o.reference ? `<p>UPI reference: <b>${esc(o.reference)}</b></p>` : ''}<p>See every sale and payout in your dashboard.</p>`,
      button: { label: 'Open payouts', url: `${APP}/dashboard/payouts` },
    }),
  }
}

export function subscriptionCancelled(o: { plan: string; until: string | null }): Mail {
  return {
    subject: `Your ${o.plan} auto-renew is off`,
    html: layout({
      preheader: o.until ? `Your plan stays on until ${o.until}.` : 'Your subscription was cancelled.',
      title: 'Auto-renew is turned off',
      body: `<p>Your <b>${esc(o.plan)}</b> subscription will not renew${o.until ? `. Your plan stays active until <b>${esc(o.until)}</b>` : ''}, then your account moves to the free Starter plan. Your page and content stay safe.</p><p>Changed your mind? You can subscribe again any time.</p>`,
      button: { label: 'Open billing', url: `${APP}/dashboard/billing` },
    }),
  }
}

export function autoRenewStopped(o: { plan: string; until: string | null }): Mail {
  return {
    subject: `We could not renew your ${o.plan} plan`,
    html: layout({
      preheader: 'Auto-renew stopped after payment attempts failed.',
      title: 'Auto-renew stopped',
      body: `<p>We tried several times to renew your <b>${esc(o.plan)}</b> plan, but the payments failed, so auto-renew has stopped${o.until ? `. Your plan stays on until <b>${esc(o.until)}</b>` : ''}.</p><p>Subscribe again from the Billing page to keep your paid features.</p>`,
      button: { label: 'Renew my plan', url: `${APP}/dashboard/billing` },
    }),
  }
}

/** Plan-end reminders: 3 days before, on the day, then 1, 2, 3, 7 and 10 days after it ended */
export function planReminder(stage: string, o: { plan: string; until: string }): Mail {
  const renew = { label: 'Renew my plan', url: `${APP}/dashboard/billing` }
  const t: Record<string, { subject: string; title: string; text: string; pre: string }> = {
    'before3': { subject: `Your ${o.plan} plan ends in 3 days`, title: `Your plan ends on ${o.until}`, pre: 'Renew now so nothing stops.', text: 'After that your account goes back to the free Starter plan. Extra automations, WhatsApp alerts and sales tools will pause. Renew now and your plan continues without a gap.' },
    'day0': { subject: `Your ${o.plan} plan ends today`, title: 'Your plan ends today', pre: 'Last day of your paid plan.', text: `Today, ${o.until}, is the last day of your plan. Renew today to keep your paid features.` },
    'after1': { subject: `Your ${o.plan} plan ended yesterday`, title: 'Your plan has ended', pre: 'Come back to your paid features.', text: 'Your plan ended yesterday and your account is now on the free Starter plan. Your page and content are safe, and free comment to DM automation keeps working. Renew to switch your paid features back on.' },
    'after2': { subject: `Your ${o.plan} features are paused`, title: 'Your paid features are paused', pre: 'Two days since your plan ended.', text: 'Extra pages, WhatsApp alerts and advanced automations are paused. Renewing takes a minute and brings everything back as you left it.' },
    'after3': { subject: `Still want ${o.plan}? Renew in one minute`, title: 'Renew in one minute', pre: 'Your settings are saved.', text: 'Your settings and content are saved exactly as you left them. Renew and everything switches back on straight away.' },
    'after7': { subject: `A week without ${o.plan}`, title: 'A week without your paid plan', pre: 'Your audience keeps visiting your page.', text: 'Your page is still getting visitors. Renew to bring back your paid features and keep growing.' },
    'after10': { subject: `Last reminder: renew your ${o.plan} plan`, title: 'Last reminder', pre: 'This is our last email about your plan.', text: 'This is our last reminder about your ended plan. You can renew any time from the Billing page. Thank you for creating with Joinlyy.' },
  }
  const m = t[stage] ?? t['after1']
  return { subject: m.subject, html: layout({ preheader: m.pre, title: m.title, body: `<p>${esc(m.text)}</p>`, button: renew }) }
}
