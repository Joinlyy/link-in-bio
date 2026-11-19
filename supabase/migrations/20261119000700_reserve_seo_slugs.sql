-- Search landing pages live at /<slug>: no creator can take those names, and the files crawlers ask for stay reserved
insert into public.reserved_usernames (username) values
  ('link-in-bio-for-indian-creators'), ('instagram-comment-to-dm-automation'), ('sell-on-instagram-with-upi'), ('linktree-alternative-india'),
  ('link-in-bio-templates'), ('creator-media-kit-generator'), ('free-link-in-bio'), ('sitemap'), ('robots'), ('og-image'), ('guides'), ('blog'), ('pricing'), ('features')
on conflict do nothing;
