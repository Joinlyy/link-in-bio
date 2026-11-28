-- Old templates added an example WhatsApp block (a duplicate of the page's WhatsApp button, with a placeholder number)
-- and an example "Book a ..." link (sessions are products). Remove those untouched examples from existing pages.
delete from public.blocks
 where data ->> 'sample' = 'true'
   and (type = 'whatsapp' or (type = 'link' and data ->> 'title' ilike 'Book a%'));
