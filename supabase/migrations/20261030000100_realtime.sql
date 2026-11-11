-- Live creator <-> admin chat (RLS still applies to realtime subscribers)
alter publication supabase_realtime add table public.support_messages;
