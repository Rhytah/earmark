-- Additional monthly income sources (freelance, rent, etc.)

alter table public.app_settings
  add column if not exists extra_income jsonb not null default '[]'::jsonb;
