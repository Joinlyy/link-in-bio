# Email with Brevo

Joinlyy sends transactional email through Brevo (brevo.com, there is a free plan; check Brevo for the current daily limit).
The helper is `supabase/functions/_shared/email.ts`. Today it sends:

- a new buyer support request to your support email (with the buyer as Reply-To),
- your reply to a buyer's support request.

Until the two secrets below exist, email is skipped and the support inbox still works (WhatsApp and the admin inbox are unaffected).

## 1. Brevo account

1. Create a Brevo account and sign in.
2. **Senders, domains and IPs, then Domains:** add `joinlyy.com`. Brevo shows DNS records (Brevo code, DKIM, DMARC; SPF if you do not have one). Add them where `joinlyy.com`'s DNS is managed, then press Authenticate. This keeps mail out of spam.
3. **Senders:** add the address you want mail to come from, for example `support@joinlyy.com`, and verify it (Brevo emails a code to that mailbox, so the mailbox must exist: create it or forward it).
4. **SMTP & API, then API keys:** create an API key named `joinlyy-edge`. Copy it once.

## 2. Secrets in Supabase

Run these in a terminal in the project folder (the key goes in your shell, not in git):

```bash
supabase secrets set BREVO_API_KEY=xkeysib-your-key EMAIL_FROM=support@joinlyy.com EMAIL_FROM_NAME=Joinlyy --project-ref sdxvwmkzjqwmvsyscxup
```

No redeploy is needed: the function reads the secrets on every request.

## 3. Test

1. In the admin, open **Buyer support** and enter your alert email (the inbox you can read).
2. Create a test ticket from an order page.
3. Open the ticket in the admin: the "Alerts" line shows `email sent`, or the reason it failed (for example "sender not verified").

## 4. Sign-in emails (magic links, password reset)

These come from Supabase Auth, which limits its own default mailer. In the Supabase dashboard open Authentication, then SMTP Settings, turn on custom SMTP and enter:

- Host `smtp-relay.brevo.com`, port `587`
- Username: your Brevo login email; password: an SMTP key from Brevo (SMTP & API, then SMTP)
- Sender: the same verified address, name Joinlyy

## What can send email next

Order confirmation to the buyer, "your plan is active" after you approve a plan payment, and a welcome email. Add them by calling `sendEmail` from the relevant function.

## Automatic emails (built)

The `email` function sends these, triggered by the database and recorded once each in `email_log`:

| Email | Goes to | When |
| --- | --- | --- |
| Welcome | New creator | After sign-up (also adds them to the Brevo contact list) |
| Order confirmed | Buyer | An order becomes paid |
| New order | Creator | An order becomes paid |
| Payment not found | Buyer | A creator rejects a UPI payment |
| Plan active / payment not confirmed | Creator | You approve or reject a plan payment |
| Plan ending in 3 days / plan ended | Creator | Daily at 09:00 IST |
| Request received / reply | Buyer | Buyer support tickets |

Secrets used: `BREVO_API_KEY`, `EMAIL_FROM`, optional `EMAIL_FROM_NAME` and `BREVO_LIST_ID` (the Brevo list new creators join).
