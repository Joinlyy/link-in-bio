# First-time user and usability test: 10 Nov 2026

> **Update:** the four P1 issues are fixed in code, along with the sign-up "reserving" wording.
>
> - **Instagram:** hidden everywhere until `VITE_INSTAGRAM_ENABLED=true`.
> - **Address:** the real app address is shown; set `VITE_PUBLIC_DOMAIN` once you have a domain.
> - **Going live:** setup ends with a **Make it live** step, and the dashboard shows a private-page banner.
> - **Pricing:** home page pricing is read from the plans table.
>
> Everything was tested in the browser except the new final setup step, which needs a fresh account.

**How I tested:**
- **As a new visitor:** a separate signed-out window. I read the home page and tried the username box, sign-up, sign-in and a creator page with products, checkout and Report.
- **As a creator:** the signed-in test account (`pawar.2330`), opening every dashboard screen at desktop width and at phone width (375px).
- **Nothing saved:** to avoid changing live data, I stopped every journey before anything was saved or sent: no orders, sign-ups, leads or reports were created, and the one username I typed was put back.
- **Source code:** I only read it to confirm what I saw on screen.

**Not tested** (needs a fresh account or would change real data):
- creating a new account and the onboarding flow from start to finish (read from the code instead)
- Google sign-in
- a real purchase
- Instagram connection
- admin screens (this account isn't an admin)

## A. Overall assessment

**Overall UX score: 6 / 10**

| | |
|---|---|
| Easy for a first-time user? | **Partly.** The dashboard is clear, consistent and works well on phones. Getting from "signed up" to "my page is live and looks finished" is where people get lost. |
| Usable without help? | Mostly for the dashboard. Not for launch: several promises (Instagram import, the shown address, what's free) don't match what happens. |
| Biggest problems | Instagram is advertised everywhere but isn't connected; new pages aren't live and look empty; the address shown (`yourbrand.in/…`) isn't real; the home page pricing contradicts the app. |
| Launch now? | **No.** The P1 issues below would make a new creator think the product is broken or misleading in their first ten minutes. Most are configuration or wording, not rebuilds. |

What's genuinely good:
- The dashboard is calm and consistent: one tab style, clear headings, an info icon on fields and a help icon on every screen.
- Every one of the 21 dashboard screens fits a phone with no sideways scrolling.
- Empty states explain what to do next.
- Validation is clear: a username can be checked live with plain messages, and checkout won't submit without a name and email.

## B. Page-by-page

| Page | Purpose | Score | Works well | Confusing / problems | Improve |
|---|---|---|---|---|---|
| Home page (visitor) | Explain the product, start sign-up | 6 | Strong headline; a live example page; FAQ; username box goes straight to sign-up | **Pricing says** digital products, UPI and 1:1 bookings are **Pro, "coming soon"**, but the app gives them free. Step 2 promises **Instagram import**, which doesn't work yet. It says "8 themes" (there are 33 designs). Big numbers ("24,350 page views", "<1s load") look like real stats. Menu doesn't close with Esc. | Make pricing match the Plan screen; hide the Instagram step until it works; label example numbers as examples |
| Sign up | Create an account | 5 | One button, little to fill | **Google only.** No email option, though Sign in offers password and email link. It says "**Reserving** yourbrand.in/admin for you" for a name that is reserved and can never be taken. | Add email sign-up; check the name before promising it |
| Sign in | Return to the dashboard | 8 | Password and email-link options; clear browser checks for empty or invalid email | Nothing major | |
| Onboarding (from code) | Username → design → Instagram | 6 | Live username check; three numbered steps | Asks about a **lead popup before** you've picked a design. Ends on "**Connect Instagram**", which fails today. **Never tells you the page is still a draft.** New pages start unpublished. | Move the popup choice to Settings; finish with a "Go live" step |
| Public creator page | What visitors see | 5 (test page) | Fast, clean; menu; Report link; "page not found" offers to claim the name | A new page shows **only the name and bio**. Examples are hidden from visitors (correct), so until you fill things in, the live page looks empty. | After a template is applied, show a short "3 things to fill before going live" list |
| Product popup and checkout | Buy a product | 8 | Clear date and time picker in IST; test-mode note; won't pay without name and email | Inputs use placeholder text as the only label; "Apply" (coupon) sits alone | Add small labels above inputs |
| Overview | Weekly summary and next steps | 6 | Set-up checklist, share card, QR code | "**Earned ₹5.1K**" counts **test orders as real money**; the checklist includes "Connect Instagram" (not possible); the shown address is `yourbrand.in/…` | Separate test earnings; hide unavailable steps |
| Website → Pages | Edit every page and section | 7 | One list of pages, Example tags, live preview, drag to reorder | Example sections look like real content in the editor; the Home page of a template is mostly Examples | |
| Website → Design | Fine-tune the look | 5 | Every option is visible | Overlaps with Templates: "Themes" (8) here and "Templates" (33) there both change colours. "Trust line" is in two places. Long screen of options. | Rename Themes to "Colour presets" and point to Templates; keep Trust line in one place |
| Website → Templates | Pick a design | 8 | Previews show your own site; Undo; switching never moves content | Two options in the confirm dialog need careful reading | |
| Products | Create and manage products | 7 | Categories, Cards/Table, limits shown (6 of 10 live), test-mode note | Picking a product type **creates an "Untitled product" draft immediately**: two abandoned drafts sit in the list. Many small tap targets on phones. | Create the product only on first save |
| Sales | Orders, bookings, questions, disputes, payouts | 7 | Tabs, table, CSV export, refund | "Total earned ₹5,139" is test money; Payouts says "coming soon" | Label test orders as test in the totals |
| Content & forms | Add videos, forms, reviews | 8 | Tapping opens the form straight away; "Already on your site" for one-only items | Lead form and reviews also appear on Home, so they show in two screens (explained by a note) | |
| Brand → Collabs | Deal pipeline | 8 | Board and table, stage pop-ups, totals | — | |
| Brand → Brand form | The form brands use | 6 | Clear fields, own-link option | The brand form is an **Example**, so "Work with me" is **not on the live site** until edited. Easy to miss. | Say "Not live yet: edit to publish" in the title |
| Brand → Invoices | GST invoices | 8 | Automatic GST split, PDF, reminders | — | |
| Brand → Media kit | Pitch page for brands | 6 | Live preview, rate card | Shows the **local address** at the top and **yourbrand.in** in the kit; stats need Instagram | Use one real domain |
| Audience / Leads | Contacts and segments | 8 | Filters, segments, CSV, consent recorded | — | |
| DM automation | Instagram auto-replies | 4 | Clear explanation and templates | **Can't be used**: needs Instagram, which can't connect | Hide or mark "Coming soon" until Instagram works |
| Analytics | Visits, clicks, sales | 5 | Ranges, sources, devices, funnel | **Click-through rate 250%** and funnel steps above 100% ("Link clicks 250% of previous") look broken to a normal user | Cap at 100% or explain repeat clicks; rename to "clicks per view" |
| Settings | Socials, Instagram, username, domain | 7 | Live username check; warning that changing it breaks links | A reserved name says "Sorry, that one's taken" | Say "This name is reserved" |
| Team / Plan / Refer & earn / Messages | Account | 7 | Clear limits and usage bars; referral link; support chat | Plan upgrades are instant and free (test mode); referral link shows `localhost` | Turn on real billing before launch |
| Guide | Help | 7 | Covers every tab in plain words | Long; mentions "change only the look" | |

## C. Issues

### P0: Critical
None found. No broken core journey, privacy leak or data-loss risk turned up in this test. Security was covered in the separate audit.

### P1: High

**1. Instagram is promised but can't connect**
- **Where:** home page step 2, onboarding step 3, Overview checklist, Settings, Media kit, DM automation, Latest Reel section.
- **Steps:**
  1. Sign up.
  2. On the final onboarding step, tap **Connect Instagram**.
- **Expected:** Instagram connects and your photo, bio and stats are imported.
- **Actual:** it can't work. The Instagram app keys aren't set on the server (`INSTAGRAM_APP_SECRET` and related are missing).
- **Impact:** the first "magic" moment fails; DM automation and media kit stats stay empty.
- **Fix:** set up the Meta app and secrets, or hide every Instagram entry point behind a "Coming soon" label until then.

**2. The address shown everywhere isn't real**
- **Where:** home page, Overview share card, Settings, Media kit, 404 page.
- **Steps:** open Overview and look at **Share your page**.
- **Expected:** your real address.
- **Actual:** `yourbrand.in/pawar.2330`, a placeholder. The **Copy link** button copies the real site address, so the text and the link disagree. The media kit editor shows a different `localhost` address again.
- **Impact:** creators type or print an address that doesn't exist, for example in a bio or on a QR caption.
- **Fix:** set `VITE_PUBLIC_DOMAIN` to the real domain before launch.

**3. A new page isn't live, and nothing says so**
- **Where:** end of onboarding.
- **Steps:**
  1. Finish onboarding.
  2. Share your link.
- **Expected:** the page opens for visitors.
- **Actual:** new pages start as **Draft** (database default `is_published = false`), so visitors get "This page doesn't exist". The only switch is a small **Live/Draft** toggle in the top bar.
- **Impact:** creators share a link that shows a 404, which feels like the product is broken.
- **Fix:** end onboarding with a clear "Go live" step, or show a banner "Your page is a draft: visitors can't see it yet. Go live" until it's published.

**4. The home page pricing contradicts the app**
- **Where:** home page Pricing compared with Settings → Plan.
- **Expected:** the same story in both places.
- **Actual:** the home page says digital products, UPI and 1:1 bookings are Pro, "coming soon". In the app they're on Free (10 live products), and Pro can be bought instantly (free in test mode).
- **Impact:** confusion about what's paid, and a trust problem.
- **Fix:** generate the home page pricing from the same plan list as the Plan screen.

### P2: Medium

**5. Sign-up promises a name it hasn't checked**
- **Steps:** type `admin` on the home page, then press Claim.
- **Actual:** "Reserving yourbrand.in/admin for you". It's reserved, so onboarding will refuse it later.
- **Fix:** check availability in the home page box, and say "if it's free" until then.

**6. Sign-up is Google only**
- **Actual:** creators without Google, or who don't want to use it, can't join, though sign-in offers password and email link.
- **Fix:** add email-link sign-up.

**7. Test money is shown as earnings**
- **Where:** Overview, Sales, Audience, Analytics.
- **Actual:** "Earned ₹5.1K" from test orders.
- **Impact:** wrong numbers at launch if test data stays, and confusing during testing.
- **Fix:** exclude or tag test orders in totals, and clear test data before launch.

**8. Analytics shows impossible percentages**
- **Where:** Analytics.
- **Actual:** Click-through rate 250%; funnel steps "250% of previous".
- **Impact:** looks broken.
- **Fix:** count unique clickers, or cap the value and explain.

**9. Choosing a product type creates an empty product**
- **Where:** Products → New product → pick a type, then go back.
- **Actual:** an "Untitled product" draft stays in the list. There are two in this account now.
- **Fix:** create the product on first save, or remove untouched drafts.

**10. Templates and Themes overlap**
- **Where:** Website → Design compared with Website → Templates.
- **Actual:** two different places change colours, and "Trust line" appears in Website → Pages and in Design.
- **Fix:** call Design's themes "Colour presets", and say "For a complete design, see Templates".

**11. Example sections make the live page look empty**
- **Where:** after applying a template.
- **Actual:** the editor and preview look full, but the public page shows only the name. The brand form and lead form are Examples, so "Work with me" isn't live.
- **Fix:** after a template, show "Fill these in to go live:" with direct links. Mark Example titles "Not on your site yet".

**12. DM automation is a dead end**
- **Fix:** hide it or label it "Coming soon" until Instagram works.

### P3: Low

**13. Menu doesn't close with Esc** on the home page.

**14. Checkout inputs have no visible labels**: placeholders disappear while typing.

**15. Info icons are small to tap on phones** (20px). Products has 33 targets under 32px.

**16. Reserved usernames say "taken"**: say "reserved".

**17. Home page numbers look like real stats** ("24,350 page views", "2 min", "<1s"). Mark them as an example, or use real figures.

**18. Onboarding asks about a lead popup before you've picked a design**: move it to Settings or later.

**19. Analytics table** shows tab characters between headings in page text. This is cosmetic and only for screen readers.

## D. Journeys tested

| Journey | Completed? | Difficulty | Steps | Where it got hard | Improve |
|---|---|---|---|---|---|
| Understand the product from the home page | Yes | Easy | Read | Pricing and Instagram claims don't match the app | Issues 1, 4 |
| Claim a name and sign up | Up to Google (not signed in) | Easy | 3 | False "reserving" promise; Google only | Issues 5, 6 |
| Sign in with bad input | Yes | Easy | 2 | — | — |
| Visitor opens a creator page, browses Shop, opens a product | Yes | Easy | 3 | Thin page when content is Examples | Issue 11 |
| Visitor tries to pay without details | Blocked correctly | Easy | 2 | — | Labels (issue 14) |
| Visitor reports a page | Dialog opened (not submitted) | Easy | 2 | — | — |
| Creator checks how they're doing | Yes | Medium | 2 | Test money, 250% CTR | Issues 7, 8 |
| Creator changes design | Yes (tested earlier, with Undo) | Easy | 4 | Two confirm options to read | — |
| Creator adds a video in Content & forms | Yes (tested earlier) | Easy | 3 | — | — |
| Creator changes username | Checked, not saved | Easy | 2 | "Taken" vs reserved | Issue 16 |
| Creator connects Instagram | **No** | Not possible | — | Not configured | Issue 1 |
| Creator shares their page | Partly | Confusing | 2 | Shown address isn't real; draft page 404s | Issues 2, 3 |

## E. Confusing elements

| Element | Where | Better wording or design |
|---|---|---|
| "Reserving yourbrand.in/admin for you" | Sign up | "We'll check yourbrand.in/admin is free next" |
| "Live" / "Draft" toggle | Top bar | "Visitors can see your page" / "Only you can see your page", plus a banner while it's a draft |
| "Themes" | Design | "Colour presets" |
| "Trust line" | Two screens | One place, with "Short line under your name, e.g. 2 lakh followers" |
| "Example" tag | Editor | "Example: not on your site yet" |
| "Click-through rate 250%" | Analytics | "Clicks per visit: 2.5" |
| "Total earned" | Sales | "Total earned (test orders)" while in test mode |
| "Payouts" tab | Sales | Hide until payouts exist, or say "Coming soon" in the tab |
| "Connect Instagram" | Many | "Instagram import: coming soon" until it works |
| "Sorry, that one's taken" for reserved names | Settings | "This name is reserved" |

## F. Improvement roadmap

**1. Must fix before launch**
- Set the real domain (issue 2).
- Make Instagram work or hide it everywhere (issues 1, 12).
- Make the draft state obvious and end onboarding with "Go live" (issue 3).
- Align the home page pricing with the Plan screen (issue 4).
- Clear test orders, and turn off test payments in the database (`app_settings`).

**2. Important**
- Email sign-up (issue 6).
- Check names before promising them (issue 5).
- Fix analytics percentages (issue 8).
- Create products on first save (issue 9).
- Guide new creators from Examples to a filled, live page (issue 11).

**3. Nice to have**
- Merge Themes into Templates wording (issue 10).
- Checkout labels (issue 14).
- Bigger info icons (issue 15).
- Wording fixes (issues 13, 16–19).

## G. Final verdict

- **Can a new user use it alone?** Inside the dashboard, mostly yes: it's clear and consistent. Getting to a live, filled page is not yet self-explanatory.
- **Biggest reason to quit:** they share their new link and it shows a "page doesn't exist" draft, or an almost empty page, after being promised an Instagram import that never happens.
- **Three changes with the biggest impact:**
  1. A clear "Go live" step plus a short "fill these 3 things" checklist after picking a template.
  2. The real domain everywhere.
  3. Instagram either working or clearly marked "coming soon".
- **What stands between this and an excellent experience:** the first ten minutes. Each screen works; the path between them, and the promises made on the home page, don't yet line up with what happens.
