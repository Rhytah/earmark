-- Budget app tables (matches src/lib/hooks.js + pages)
-- Run in Supabase: SQL Editor → New query → paste → Run

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null,
  description text not null default '',
  amount numeric not null,
  payment_method text not null default 'Card',
  created_at timestamptz not null default now()
);

create table if not exists public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  month text not null,
  created_at timestamptz not null default now()
);

create index if not exists gym_sessions_month_idx on public.gym_sessions (month);

create table if not exists public.savings_snapshots (
  month text primary key,
  emergency_balance numeric not null default 0,
  investment1_balance numeric not null default 0,
  investment2_balance numeric not null default 0,
  investment3_balance numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security (required for PostgREST; policies allow the anon API key to CRUD)
alter table public.expenses enable row level security;
alter table public.gym_sessions enable row level security;
alter table public.savings_snapshots enable row level security;

drop policy if exists "expenses_anon_all" on public.expenses;
drop policy if exists "gym_sessions_anon_all" on public.gym_sessions;
drop policy if exists "savings_snapshots_anon_all" on public.savings_snapshots;

create policy "expenses_anon_all"
  on public.expenses for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "gym_sessions_anon_all"
  on public.gym_sessions for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "savings_snapshots_anon_all"
  on public.savings_snapshots for all
  to anon, authenticated
  using (true)
  with check (true);
