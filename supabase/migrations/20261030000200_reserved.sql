-- Route names used by public pages
insert into public.reserved_usernames (username) values ('order'), ('orders'), ('checkout'), ('shop'), ('pay')
on conflict do nothing;
