-- Display-only offer fields on each plan: the crossed-out list price (monthly) and a badge. Editable in Admin > Plans.
update public.plans set features = features || '{"compare_monthly_inr": 299, "badge": "Best seller", "tagline": "Most creators start here"}'::jsonb, updated_at = now() where id = 'pro';
update public.plans set features = features || '{"compare_monthly_inr": 599, "badge": "Best value", "tagline": "For full-time creators and teams"}'::jsonb, updated_at = now() where id = 'business';
update public.plans set features = features || '{"tagline": "Free forever, no card needed"}'::jsonb, updated_at = now() where id = 'free';
