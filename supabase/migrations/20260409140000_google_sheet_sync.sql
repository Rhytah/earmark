-- Per-user Google Sheet sync settings + expense source tracking

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
