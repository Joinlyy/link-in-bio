-- Meta's Instagram deauthorize and data deletion callbacks (required for App Review).
-- The instagram-data function records each request here; people can check a deletion with its code at
-- /data-deletion?code=… without signing in.
create table if not exists public.instagram_data_requests (
  code text primary key,
  kind text not null check (kind in ('deauthorize', 'delete')),
  ig_user_id text not null,
  found boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.instagram_data_requests enable row level security;
revoke all on public.instagram_data_requests from anon, authenticated;

/** Status of a data deletion request by its confirmation code (no personal data returned) */
create or replace function public.instagram_deletion_status(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', r.code, 'requested_at', r.created_at, 'completed_at', r.completed_at,
    'status', case when r.completed_at is not null then 'complete' else 'in_progress' end)
  from public.instagram_data_requests r
  where r.code = p_code and r.kind = 'delete';
$$;
grant execute on function public.instagram_deletion_status(text) to anon, authenticated;
