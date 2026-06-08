-- Investment transactions imported from statements (CSV/paste)
create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  asset text not null,
  tx_type text not null check (tx_type in ('buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal')),
  amount numeric not null default 0,
  units numeric,
  price numeric,
  notes text not null default '',
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists investment_transactions_date_idx
  on public.investment_transactions (date);

create index if not exists investment_transactions_asset_idx
  on public.investment_transactions (asset);

alter table public.investment_transactions enable row level security;

drop policy if exists "investment_transactions_anon_all" on public.investment_transactions;
create policy "investment_transactions_anon_all"
  on public.investment_transactions for all
  to anon, authenticated
  using (true)
  with check (true);
