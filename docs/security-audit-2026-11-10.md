# Security audit and hardening: 10 Nov 2026

React + Supabase link-in-bio platform. I audited the live database (project `sdxvwmkzjqwmvsyscxup`), edge functions, Vercel config and frontend, then fixed what could be fixed in code.

**The database migration was applied to the live database on 10 Nov 2026, and all 47 database tests pass against it.** The edge function and frontend changes still need deploying (see the checklist).

## 1. Summary

| | Count |
|---|---|
| Vulnerabilities found | **23** |
| Critical | 0 |
| High | 2 |
| Medium | 7 |
| Low | 14 |
| Fixed in code or migration, and tested | 15 |
| Need manual configuration | 2 findings (H1 switch, L12 auth settings), plus deploy steps |
| Remaining, not fixed | 6 |

What was already sound:
- RLS is on for all 32 tables.
- Anonymous visitors have no table access, so public pages go through security-definer functions that return only public fields.
- A trigger stops users changing their own role, plan or status.
- Ownership checks use `auth.uid()` everywhere.
- Instagram tokens live in a server-only table.
- No `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere.
- The database rejects non-http(s) links.

## 2. Findings

| ID | Severity | Where | Risk | Fix | Status |
|---|---|---|---|---|---|
| H1 | High | `create_test_order`, `create_test_tip`, `accept_upsell`, `test_upgrade` | Test-mode payments: anyone can get paid products, upsells and Pro plans without paying. Fine in testing, a revenue hole in production. | `app_settings.test_payments` switch, checked by all four functions. On by default, so nothing changes until you turn it off. | Fixed. **Turn off before launch.** |
| H2 | High | RLS helper `page_role`, storage policies | Suspended creators kept full API access: they could edit pages, upload and read leads. Only the app screen blocked them. | `page_role`, page insert/delete, DM rules and storage writes now require an active profile. | Fixed and tested |
| M1 | Medium | `orders.access_token` | Creators (and team viewers) could read buyers' order tokens and act as the buyer: open disputes, book sessions, download. | Column-level grant without `access_token`. The app now names its columns. | Fixed and tested |
| M2 | Medium | `is_admin()` | Admin powers needed only a password or Google login. | `is_admin()` now requires two-step login (`aal2`). The admin screen explains how to turn it on. | Fixed and tested |
| M3 | Medium | `vercel.json` | No Content-Security-Policy or Permissions-Policy, so any future XSS could load scripts from anywhere. | CSP that allows only what the app uses, plus Permissions-Policy and COOP. | Fixed and tested locally |
| M4 | Medium | `vercel.json` HSTS | `includeSubDomains; preload` was also sent on creators' custom domains and could break their other subdomains. | Plain `max-age`. | Fixed |
| M5 | Medium | `instagram-webhook` | With `INSTAGRAM_APP_SECRET` unset (it is unset today), anyone could sign fake events. | Returns 503 unless the secret is set. | Fixed in code, needs function deploy |
| M6 | Medium | `check-url` | The Google Safe Browsing check runs only when the app calls it. A direct API write skips it. | Scan server-side (DB trigger plus pg_net, or a scheduled rescan). | **Remaining** |
| M7 | Medium | `submit_lead`, `submit_enquiry`, test checkout | Per-contact limits only. Rotating emails could flood a creator with fake leads, enquiries or orders. | Per-page caps: 30 leads/min, 20 enquiries/10 min, 30 orders or tips/min. | Fixed and tested |
| L1 | Low | Table grants | API roles held TRUNCATE, TRIGGER and REFERENCES (RLS doesn't apply to TRUNCATE). Anon held write grants on `plans`. | Revoked, including default privileges for future tables. Anon keeps SELECT on plans. | Fixed and tested |
| L2 | Low | `support_messages` | A creator could rewrite their own messages, including changing the sender to "admin". | Creators can update only `read_at`. | Fixed and tested |
| L3 | Low | `set_updated_at`, `url_host` | No fixed `search_path`. | Set to `''`. | Fixed |
| L4 | Low | `reserved_usernames` | Missing app routes and public files (academy, invoices, sw.js, robots.txt…). | 24 names added. No existing page uses them. | Fixed |
| L5 | Low | `_shared/utils.ts` and webhook | 500 responses returned raw database or auth error text. | Generic message, detail logged. | Fixed in code, needs deploy |
| L6 | Low | `instagram-webhook` | Verify token compared with `===`. | Constant-time compare. | Fixed in code, needs deploy |
| L7 | Low | `AuthContext.jsx`, `PasswordPages.jsx` | The `?next=` redirect accepted `//evil.com` and `/\evil.com`. | `safeNext()` allows only same-site paths. | Fixed and tested |
| L8 | Low | Edge function CORS | Falls back to `*` because `APP_ORIGIN` isn't set. | Set `APP_ORIGIN` to your site URL. | **Manual** |
| L9 | Low | `instagram` sync/authorize, `/api/track` | No rate limiting. Analytics can be inflated. | Cooldown on sync, prune OAuth states, Vercel WAF rule on `/api/track`. | **Remaining** |
| L10 | Low | `download` | The download counter isn't atomic, so the 50-download cap can be exceeded with parallel requests. | Atomic `update … where downloads < 50 returning`. | **Remaining** |
| L11 | Low | `account` | Account deletion needs no fresh sign-in, and files in storage are left behind. | Require a recent login and delete storage objects. | **Remaining** |
| L12 | Low | Supabase Auth settings | Not in the repo, so password policy, leaked-password check, confirmations and the redirect list can't be verified. | Dashboard settings (checklist). | **Manual** |
| L13 | Low | `coupon_discount` | Coupon codes can be guessed with no throttle. | Rate-limit per page or require longer codes. | **Remaining** |
| L14 | Low | `product-files` bucket | Allows SVG and `application/octet-stream`, so a creator could sell malware to buyers. | Narrow the MIME list, or scan uploads. | **Remaining** (accepted for now) |

## 3. Database RLS policies and grants changed

Migration: `supabase/migrations/20261110000100_security_hardening.sql`. It is backward compatible, changes or deletes no data and keeps all relationships.

- **New table `app_settings`:** RLS on, admin read only, no API writes.
- **`page_role()`:** returns nothing for suspended users. Every policy built on `can_view_page`, `can_edit_page` and `can_manage_page` inherits this.
- **Recreated policies:**
  - `pages: insert own`
  - `pages: delete own`
  - `dm_rules: owner all`
  - `creator-images: owner insert`
  - `creator-images: owner update`
- **`is_admin()`:** now requires `aal2`.
- **Revoked from `anon` and `authenticated`:** TRUNCATE, TRIGGER and REFERENCES on all public tables.
- **`plans`:** anon now has SELECT only.
- **`orders`:** SELECT is column-level, without `access_token`.
- **`support_messages`:** UPDATE is limited to `read_at`.
- **Wrapped functions:** the four test-payment functions and the two public form functions call `*_impl` functions that the API can't reach.
- **Fixed search_path:** set on the last two functions that lacked one.

## 4. Storage policies changed

- `creator-images` insert and update now also require an active (not suspended) account.
- `product-files` read, insert and delete go through `can_write_owner_folder()`, which now requires an active account.
- No change was needed for:
  - folder ownership (`<user id>/…`)
  - bucket size and MIME limits (images 5 MB; product files 100 MB)
  - private product files, which reach buyers only through the `download` function and short-lived signed URLs

## 5. API improvements

- **Edge functions:** generic errors on 500, and the webhook refuses to run without its secret and compares its token in constant time.
- **Public forms:** server-side flood caps.
- **Untouched:**
  - every function's existing auth: JWT check in account, check-url, domains and instagram; order token in download; signature or cron secret in the webhook
  - the database never trusts prices, owners or roles from the client
  - the Razorpay webhook is still to be built when payments go live, and must verify signatures

## 6. Authentication improvements

- **Admin:** needs two-step login, enforced by the database. The admin screen asks for it if missing.
- **Suspended accounts:** blocked on the server, and can still see their own profile so the app can explain why.
- **Sign-in redirect:** limited to this site.

## 7. Security headers (vercel.json)

| Header | Value |
|---|---|
| Content-Security-Policy | `default-src 'self'`, scripts from self + Google Tag Manager + Meta Pixel, Supabase https/wss in `connect-src`, YouTube / Instagram / Spotify frames only, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`, `upgrade-insecure-requests` |
| Permissions-Policy | camera, microphone, geolocation and USB off; payment for self |
| Strict-Transport-Security | `max-age=63072000` (safe on custom domains) |
| Cross-Origin-Opener-Policy | `same-origin-allow-popups` (keeps Google sign-in working) |
| Already present | X-Content-Type-Options, Referrer-Policy, X-Frame-Options |

## 8. Tests performed

All of these are automated and saved in `scripts/security-tests/`.

**Database access** (`node scripts/security-tests/run-db.mjs`):
- **Before the migration:** 36 pass, 6 fail (tests 23, 31, 34, 37, 38, 39).
- **With the migration:** all 47 pass.
- **How it runs:** it acts as anonymous, Creator A, Creator B, an administrator and a suspended creator against the live schema. Everything is inside one transaction that is rolled back.

**Rendering** (`node scripts/security-tests/xss.test.mjs`): renders a creator page with the app's real components. All 14 checks pass:
- Script and `onerror` payloads in name, bio, trust line, links, FAQ, reviews, cards and WhatsApp label render as text.
- No `javascript:`, `data:`, `vbscript:` or `file:` value reaches any `href` or `src`, including social links.

**Live API checks**:
- Anon REST reads of pages, leads and orders are refused.
- Forged and expired JWTs are refused by the REST API and edge functions.
- The public page RPC returns only public fields.
- Invalid order tokens can't download files.

**Headers** (local server with the same headers): allowed embeds load, while inline scripts and unknown scripts, frames and fetches are blocked.

**Redirect guard**: 7 of 7 cases pass.

| Requested scenario | Result |
|---|---|
| 1. Anon reads private creator data | Refused (tests 01–04, 09; live REST) |
| 2. Creator A reads Creator B's data | Refused (tests 13–15, 19, 22) |
| 3. Creator A changes Creator B's profile | Refused (tests 16–18, 20, 21) |
| 4. Anon updates a public profile | Refused (test 05) |
| 5. Unauthenticated admin access | Refused (test 07; admin without MFA also refused, test 34) |
| 6. Malicious JavaScript in a bio | Rendered as text (XSS test) |
| 7. Dangerous URL schemes as social links | Made safe (XSS test); rejected by the database for links (tests 25–26) |
| 8. Unauthorized file upload | Refused (tests 10, 21, 39) |
| 9. Private file access without authorization | Refused (test 22; download function with bad token) |
| 10. Expired session does protected work | Refused (live REST and edge function) |
| 11. Public API data exposure | Only public fields (test 11; live RPC) |
| 12. Users change their own role or permissions | Ignored (tests 27–30b, 33) |

## 9. Remaining risks

- **Not live yet:** the database, edge function and frontend fixes take effect only after the deploy steps below.
- **Test payments:** checkout stays free until you turn the switch off.
- **Not fixed:** M6, L9, L10, L11, L13 and L14 from the findings table.
- **Not verified:** Supabase Auth dashboard settings (L12).
- **Not run:** no penetration test against the deployed site, because only the local build was tested with the new headers.

## 10. Production checklist

1. **Apply the migration (done 10 Nov 2026):**
   ```bash
   npx supabase db push --linked
   ```
2. **Rerun the database tests:** `node scripts/security-tests/run-db.mjs` should show 47 passed.
3. **Deploy the edge functions:**
   ```bash
   npx supabase functions deploy
   ```
4. **Deploy the frontend to Vercel.** The app and database changes depend on each other: the new Sales code works before the migration, but the old Sales code breaks after it.
5. **Before real customers, turn off test payments:**
   ```sql
   update public.app_settings set test_payments = false;
   ```
6. **Edge function secrets:**
   - `APP_ORIGIN` = your site URL
   - Instagram secrets (`INSTAGRAM_APP_SECRET`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`) and `CRON_SECRET` before you turn Instagram on
7. **Supabase Dashboard → Authentication:**
   - email confirmations on
   - minimum password length 8 or more, with leaked-password protection
   - Site URL and redirect allow-list set to your exact domains (`/auth/callback`)
   - default rate limits kept
   - CAPTCHA (hCaptcha or Turnstile) on sign-up and password reset
8. **Admins:** turn on two-step login in Settings, then sign out and in again before opening the admin area.
9. **Vercel:**
   - add a WAF or rate-limit rule for `/api/track` and the auth pages
   - after launch, consider HSTS `includeSubDomains; preload` for your main domain only
10. **After deploying, check the browser console on a public page, the dashboard and the admin area for CSP errors.**
