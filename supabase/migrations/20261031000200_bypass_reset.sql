-- Trusted functions switch the protect bypass off again as soon as they are done,
-- so it can never leak to later statements in the same transaction.
create or replace function public.test_upgrade(p_plan text, p_period text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pl public.plans;
  pr public.profiles;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_period not in ('month', 'year') then raise exception 'Invalid period' using errcode = 'P0001'; end if;
  select * into pl from public.plans where id = p_plan and is_active and id <> 'free';
  if not found then raise exception 'Plan not available' using errcode = 'P0001'; end if;
  select * into pr from public.profiles where id = auth.uid();
  v_start := case when pr.plan = p_plan and pr.plan_expires_at > now() then pr.plan_expires_at else now() end;
  v_end := v_start + case when p_period = 'year' then interval '1 year' else interval '1 month' end;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set plan = p_plan, plan_expires_at = v_end where id = auth.uid();
  perform set_config('app.bypass_protect', 'off', true);
  insert into public.subscriptions (user_id, plan, period, amount_inr, provider, starts_at, ends_at)
  values (auth.uid(), p_plan, p_period, case when p_period = 'year' then pl.price_yearly_inr else pl.price_monthly_inr end, 'test', v_start, v_end);
  return public.my_plan();
end $$;

create or replace function public.cancel_plan()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set plan = 'free', plan_expires_at = null where id = auth.uid();
  perform set_config('app.bypass_protect', 'off', true);
  return public.my_plan();
end $$;

create or replace function public.accept_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_email text := lower((auth.jwt()) ->> 'email');
begin
  if auth.uid() is null or v_email is null then return 0; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.page_members set user_id = auth.uid(), accepted_at = now()
   where email = v_email and user_id is null;
  get diagnostics v_count = row_count;
  perform set_config('app.bypass_protect', 'off', true);
  return v_count;
end $$;

create or replace function public.claim_referral(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_ref uuid;
  v_ok boolean;
begin
  select id into v_ref from public.profiles where referral_code = lower(trim(p_code)) and id <> auth.uid();
  if v_ref is null then return false; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set referred_by = v_ref
   where id = auth.uid() and referred_by is null and created_at > now() - interval '2 days';
  v_ok := found;
  perform set_config('app.bypass_protect', 'off', true);
  return v_ok;
end $$;

create or replace function public.referral_reward()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_referrer uuid;
  ref public.profiles;
begin
  if not (new.is_published and old.published_at is null and new.published_at is not null) then
    return new;
  end if;
  if exists (select 1 from public.pages where owner_id = new.owner_id and id <> new.id and published_at is not null) then
    return new;
  end if;
  select referred_by into v_referrer from public.profiles where id = new.owner_id;
  if v_referrer is null then return new; end if;

  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set referral_credits = referral_credits + 1 where id = v_referrer returning * into ref;
  if ref.referral_credits % 3 = 0 and ref.plan in ('free', 'pro') then
    update public.profiles
       set plan = 'pro',
           plan_expires_at = greatest(now(), case when plan = 'pro' then coalesce(plan_expires_at, now()) else now() end) + interval '30 days'
     where id = v_referrer;
    insert into public.subscriptions (user_id, plan, period, amount_inr, provider, ends_at)
    values (v_referrer, 'pro', 'referral', 0, 'referral', (select plan_expires_at from public.profiles where id = v_referrer));
  end if;
  perform set_config('app.bypass_protect', 'off', true);
  return new;
end $$;
