-- Run this in Supabase SQL Editor if you see "column not found in schema cache" errors.
-- Safe to run multiple times (uses IF NOT EXISTS).

-- Personal trackers
alter table public.app_settings
  add column if not exists trackers jsonb not null default '[]'::jsonb;

alter table public.gym_sessions
  add column if not exists tracker_id text not null default 'gym';

create index if not exists gym_sessions_user_tracker_month_idx
  on public.gym_sessions (user_id, tracker_id, month);

-- Google Sheet sync
alter table public.app_settings
  add column if not exists sheet_sync_enabled boolean not null default false,
  add column if not exists sheet_sync_url text not null default '',
  add column if not exists sheet_sync_interval_seconds int not null default 60,
  add column if not exists sheet_sync_last_at timestamptz,
  add column if not exists sheet_sync_last_error text,
  add column if not exists sheet_sync_last_count int not null default 0;

alter table public.expenses
  add column if not exists source text not null default 'manual',
  add column if not exists sheet_row_key text;

create unique index if not exists expenses_user_sheet_row_key_idx
  on public.expenses (user_id, sheet_row_key)
  where sheet_row_key is not null;

create index if not exists expenses_user_source_idx
  on public.expenses (user_id, source);

-- Expense receipts
alter table public.expenses
  add column if not exists receipt_path text,
  add column if not exists receipt_name text;

insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "expense_receipts_select_own" on storage.objects;
drop policy if exists "expense_receipts_insert_own" on storage.objects;
drop policy if exists "expense_receipts_delete_own" on storage.objects;

create policy "expense_receipts_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "expense_receipts_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "expense_receipts_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Profile gamification (peak XP + earned badges)
alter table public.app_settings
  add column if not exists gamification jsonb not null default '{"version":1,"peak_xp":0,"earned_badges":{}}'::jsonb;

alter table public.app_settings
  add column if not exists tracking_reminders jsonb not null default '{
    "enabled": false,
    "time": "20:00",
    "days": [0, 1, 2, 3, 4, 5, 6],
    "last_sent_at": null
  }'::jsonb;

alter table public.app_settings
  add column if not exists extra_income jsonb not null default '[]'::jsonb;

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

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
