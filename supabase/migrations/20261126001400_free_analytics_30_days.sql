-- Starter (free) plan: 30 days of analytics history instead of 7.
update public.plans set features = features || '{"analytics_days": 30}'::jsonb where id = 'free';
