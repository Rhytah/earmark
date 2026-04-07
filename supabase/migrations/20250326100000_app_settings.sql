-- Single-row app configuration (salary, budget categories, goals, gym, etc.)

create table if not exists public.app_settings (
  id text primary key default 'default',
  app_title text not null default 'My Budget',
  salary numeric not null,
  budget jsonb not null default '[]'::jsonb,
  payment_methods jsonb not null default '[]'::jsonb,
  investment_goals jsonb not null default '[]'::jsonb,
  emergency_fund_target numeric not null,
  gym_session_cost numeric not null,
  gym_sessions_per_week int not null default 3,
  gym_category text not null default 'Gym',
  emergency_category text not null default 'Emergency fund',
  investments_category text not null default 'Investments',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_anon_all" on public.app_settings;
create policy "app_settings_anon_all"
  on public.app_settings for all
  to anon, authenticated
  using (true)
  with check (true);
