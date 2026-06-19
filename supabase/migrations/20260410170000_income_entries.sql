-- Logged income inflows (date, source, amount)

create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  source text not null,
  description text not null default '',
  amount numeric not null,
  payment_method text not null default 'Bank transfer',
  created_at timestamptz not null default now()
);

alter table public.income_entries alter column user_id set default auth.uid();
create index if not exists income_entries_user_date_idx on public.income_entries (user_id, date desc);

alter table public.income_entries enable row level security;

drop policy if exists "income_entries_user_own" on public.income_entries;
create policy "income_entries_user_own"
  on public.income_entries for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
