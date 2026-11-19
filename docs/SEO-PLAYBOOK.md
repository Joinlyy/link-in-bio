# Joinlyy SEO playbook

Goal: get creators to find Joinlyy by searching for the two things we are best at: **free Instagram comment to DM automation** and **link in bio**, and make the brand name **Joinlyy** show up correctly in Google.

The on-page and off-page checklists below follow the public `seo-onpage` and `seo-offpage` skills (github.com/rampstackco/claude-skills). Those skills are plain checklists with no scripts; nothing was installed.

## 1. Brand search: "joinlyy" shows "joinly"

Google corrects rare words to common ones. "Joinlyy" is new, so it suggests "Joinly" until enough people search for and mention the exact name. It can't be forced; it is fixed by repeating the same strong signals until Google treats Joinlyy as its own entity.

Done in the code:
- Home title starts with the brand: "Joinlyy: Free Link in Bio + Instagram Comment to DM Automation (India)".
- Organization and WebSite structured data with `name`, `alternateName` ("Joinlyy.com") and `sameAs` (Instagram @joinlyy).
- `/about` page: says how to spell and say it ("join-lee", two y), what it is, and that it is not related to similarly named products.
- Footer says "Joinlyy (say join-lee)". Every creator page links back to joinlyy.com with the brand name as the anchor ("Made with Joinlyy").
- Every landing page title ends in "| Joinlyy"; Open Graph `og:site_name` is Joinlyy.

To do (you, outside the code):
1. Make the **Instagram @joinlyy** bio say "Joinlyy (join-lee): free link in bio + comment to DM" and link to https://www.joinlyy.com. Add the same link to the Meta app, WhatsApp business profile and the GitHub profile.
2. Create profiles with the exact name **Joinlyy** and the same logo and description: YouTube, LinkedIn company page, X, Facebook page, Product Hunt maker page. Link each to the site, then add each URL to `sameAs` in `index.html` and ask the dev to redeploy.
3. Get listed (brand name as the link text) on: Product Hunt, AlternativeTo, SaaSHub, BetaList, G2, Capterra, Crunchbase, Indie Hackers, Startup India style directories.
4. Put "Joinlyy" in every public post, Reel caption, bio and comment reply you write. Ask early creators to write "Made with Joinlyy" in posts.
5. In Search Console, submit https://www.joinlyy.com/sitemap.xml, then "Request indexing" for `/`, `/about` and the landing pages.
6. Search "joinlyy" yourself from different accounts, and share the Google result with friends: people clicking "Search instead for joinlyy" trains the correction away over weeks.
7. Expect 4 to 12 weeks. Track the query "joinlyy" in Search Console (Performance, filter query contains joinlyy).

## 2. Keyword map: one page, one target

| Page | Target query |
| --- | --- |
| `/` | joinlyy, link in bio india, free link in bio |
| `/instagram-comment-to-dm-automation` | free comment to dm automation, instagram auto dm |
| `/how-to-set-up-comment-to-dm` | how to set up comment to dm instagram |
| `/instagram-auto-reply-comments` | auto reply instagram comments |
| `/instagram-dm-keywords-that-convert` | instagram comment keywords for dm |
| `/manychat-alternative-india` | manychat alternative india |
| `/link-in-bio-for-indian-creators` | link in bio for indian creators |
| `/how-to-add-link-in-bio-instagram` | how to add link in bio instagram |
| `/link-in-bio-ideas` | link in bio ideas |
| `/best-link-in-bio-tools-india` | best link in bio tool india |
| `/link-in-bio-templates` | link in bio templates |
| `/linktree-alternative-india` | linktree alternative india |
| `/free-link-in-bio` | free link in bio |
| `/sell-on-instagram-with-upi` | sell on instagram with upi |
| `/creator-media-kit-generator` | creator media kit generator |
| `/about` | about joinlyy |

Two clusters feed each other: the DM-automation pillar links to its 4 guides, and the link-in-bio pillar links to its 4 guides. Each page links back to its pillar, and the home page and footer link to all of them.

## 3. On-page checklist (run for every new page)

1. One target query. Title 50-60 characters, query near the front, brand last. Meta description 150-160 characters, different from the title.
2. Exactly one H1 that contains the query; H2s for sub-topics; no skipped levels.
3. Answer the question in the first paragraph. Short paragraphs. No keyword stuffing.
4. 2-3 links out to related pages and 2-3 links in from related pages, with descriptive anchors.
5. Images: descriptive alt text, set width and height, lazy-load below the fold.
6. Slug: lowercase, hyphenated, contains the query, under 60 characters.
7. Structured data that matches visible content (FAQPage on landing pages, HowTo on how-to pages, Article on Academy).
8. Check the served HTML (view source, not the browser tools) and Search Console's URL inspection after launch.

## 4. Off-page plan (first year mix: about 70% owned assets, 20% listings, 10% partnerships)

Linkable assets to build (free tools earn links):
- UPI QR code and payment-link generator for creators.
- Instagram comment keyword and DM script generator.
- Media kit generator (exists: `/creator-media-kit-generator`).
- Free "link in bio" page checker that scores a profile link.
- Yearly "Indian creator economy" mini-survey from Joinlyy users (anonymised numbers).

Citations and listings: the directories in section 1, plus Indian startup and creator communities. Use the brand name as the link text and the same description everywhere.

Partnerships: ask 10 early creators for a short case study ("how I get X leads a month with comment to DM") that links to their page and to Joinlyy; every creator page already links back with "Made with Joinlyy".

Earned media: one story per quarter (new feature, data, a creator success story) pitched to Indian creator-economy newsletters, YouTube creators who review tools, and podcasts.

Rules: no bought links, no exact-match anchor spam (let brand and plain URL anchors lead), personalised outreach only, and check lost links every month.

## 5. 90-day calendar

- Weeks 1-2: deploy, submit sitemap, request indexing, create the brand profiles, list on 5 directories.
- Weeks 3-6: publish 2 Academy guides a month on DM automation and link in bio (see keyword map), build the first free tool, collect 3 creator case studies.
- Weeks 7-12: launch the free tool on Product Hunt and Indie Hackers, pitch one story, review Search Console and fix pages stuck at "Discovered, not indexed".

## 6. Weekly Search Console routine (15 minutes)

1. Performance: top queries and pages; note any query with impressions but low click rate and improve that page's title and description.
2. Indexing: look for new "Not indexed" reasons; fix and request validation.
3. Sitemaps: status Success, discovered URL count rising.
4. Branded query check: "joinlyy" impressions, clicks and average position.
