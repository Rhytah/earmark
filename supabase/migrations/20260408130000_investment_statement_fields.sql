alter table public.investment_transactions
  add column if not exists trans_no text,
  add column if not exists description text not null default '',
  add column if not exists deposit_amount numeric,
  add column if not exists interest_amount numeric,
  add column if not exists withdrawal_amount numeric,
  add column if not exists withholding_tax_amount numeric,
  add column if not exists balance_amount numeric;
