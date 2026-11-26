# Meta App Review: Instagram permissions (Joinlyy)

Prepared 16 Nov 2026. Paste these into **App Review → Permissions and features → Request advanced access** for the
Meta app **Joinlyy** (App ID 1292250586061533, Instagram app ID 877606478244475). One screen recording per permission
is still needed; what each recording must show is listed under that permission.

## Before you record

1. Accept the tester invite for **@joinlyy** in the Instagram app (Settings → Website permissions → Apps and websites → Tester invites).
2. Have a second Instagram account (any personal account) ready to comment and send DMs.
3. Record in English, show the full browser window including the address bar, and keep each video under 2 minutes.
4. Reviewer test account: create a JOINLYY account for the reviewer at https://joinlyy.com/signup with a dedicated
   email (not a personal one) and give the email and password in the **Test instructions** field below.

## App-level fields

**App description (what Joinlyy does)**
Joinlyy is a link-in-bio website builder for Indian creators. A creator signs up at https://joinlyy.com, builds a
one-page website (links, products, bookings, lead forms) and shares it in their Instagram bio. Creators can connect
their Instagram professional account to import their profile, show live stats in a media kit for brands, and set up
automatic DM replies: when someone comments a keyword on the creator's post or Reel, Joinlyy sends that person a DM
with the link they asked for.

**Test instructions for the reviewer**
1. Open https://joinlyy.com/signin and sign in with the test account below.
2. Go to **Settings → Instagram → Connect Instagram** and log in with an Instagram professional account.
3. **Instagram stats:** after connecting, open **Media kit**: followers, average likes/comments, engagement rate and 28-day reach appear.
4. **Comment → DM:** open **DM automation → New automation**, choose "Comment on a post or Reel", keyword `guide`, write a
   message with a link and save. From a different Instagram account, comment "guide" on any post of the connected account.
   The commenter receives a private reply DM within a few seconds; the event shows under **Recent activity**.
5. **DM keyword:** create an automation "DM with a keyword", keyword `price`, then DM the connected account the word "price".
   An automatic reply arrives.
6. To remove access: **Settings → Instagram → Disconnect**, or remove Joinlyy in Instagram (Apps and websites).
Test account: `<reviewer email>` / `<password>`

## Permission: instagram_business_basic

**How we use it**
When a creator connects Instagram, we read their profile (username, name, bio, profile picture, account type,
follower/following/media counts) and their recent posts (image, caption, permalink, like and comment counts). We use this
to (1) fill the creator's Joinlyy page with their photo, name and bio at sign-up, (2) show their latest Reel on their page,
and (3) calculate average likes, comments and engagement rate for the media kit they share with brands. The data is shown
only to the creator and, in the media kit, to people the creator shares it with. It is refreshed once a day and deleted when
they disconnect.

**Recording must show:** sign in to Joinlyy → Settings → Connect Instagram → Instagram login and consent screen → back on
Joinlyy, "Connected as @…" → open Media kit showing followers and recent posts → open the creator's public page showing the imported photo/bio.

## Permission: instagram_business_manage_comments

**How we use it**
Creators set up "comment to DM" automations: they choose a keyword (for example "GUIDE") and optionally a specific post.
We receive comment webhooks for the creator's own posts and Reels. When a comment contains the keyword, we (1) send the
commenter one private reply (the DM with the requested link) and (2) optionally post a short public reply under the comment,
such as "Sent! Check your DMs". We only act on comments on the connected creator's own media, store only the commenter's
username and the comment ID for the creator's activity log, and never post anything the creator did not write.

**Recording must show:** create a comment automation in Joinlyy (keyword, message, public reply) → from a second Instagram account,
comment the keyword on the creator's post → the public reply appears under the comment → the commenter's inbox shows the DM →
the event in Joinlyy's Recent activity.

## Permission: instagram_business_manage_messages

**How we use it**
We send the automatic DM replies the creator configured: the private reply to a keyword comment, replies to story replies and
to DMs containing a keyword, and, if the creator turns them on, a follow-up message inside the 24-hour messaging window and
a request for the person's email or WhatsApp number (saved as a lead only if they reply with it). We receive message webhooks
only to detect these keywords and replies. We never send unsolicited messages: every DM is a reply to something the person
sent first, within Instagram's messaging window.

**Recording must show:** create a "DM with a keyword" automation → from a second account, DM the keyword to the creator → the
automatic reply arrives → (optional) the person replies with an email and it appears in Joinlyy → Leads.

## Permission: instagram_business_manage_insights

**How we use it**
We read the creator's account-level reach for the last 28 days and show it in their media kit next to followers and engagement
rate. Creators send this media kit to brands to get sponsorships, so accurate reach matters to them. We read it once a day,
show it only in the creator's own dashboard and media kit, and delete it when they disconnect.

**Recording must show:** connected account → open Media kit → the "Reach (28 days)" figure.

## Permission: instagram_business_content_publish

**How we use it**
The Post scheduler (Audience → Schedule posts). A creator uploads a photo or a Reel, writes the caption and either presses
Post now or picks a future time. Joinlyy publishes exactly that file with exactly that caption to the creator's own connected
Instagram professional account through the content publishing API (create container, then publish). Creators see each post's
status, can cancel before it goes out and can open the published post. We never post anything the creator did not upload and
approve, never edit or delete existing posts, and delete the uploaded file from our storage right after it is published.

**Recording must show:** Schedule posts → choose a photo → write a caption → Post now → status changes to Posted → click View and
show the post live on Instagram. (Optional: schedule one for a time a few minutes ahead and show it going out, and cancel another.)

## Data handling answers (Data Use Checkup / reviewer questions)

- **Who sees the data:** only the creator who connected the account, and anyone they share their media kit link with.
- **Storage:** Supabase (PostgreSQL) with row-level security; Instagram access tokens are stored server-side only.
- **Retention and deletion:** data is refreshed daily; disconnecting deletes the token and profile data immediately.
  Meta's deauthorize and data deletion callbacks are implemented:
  `https://sdxvwmkzjqwmvsyscxup.supabase.co/functions/v1/instagram-data?event=deauthorize` and `…?event=delete`
  (status page: https://joinlyy.com/data-deletion).
- **Privacy policy:** https://joinlyy.com/privacy (see "Deleting your Instagram data"). Terms: https://joinlyy.com/terms.
- **No data is sold or used for advertising.**

## Business verification

Required before advanced access is granted: Meta Business Settings → Security centre → Start verification, with the company's
registration documents (for example GST certificate or certificate of incorporation) and a phone number or email on the
business domain (support@joinlyy.com).
