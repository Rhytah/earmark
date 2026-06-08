create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  insurer text,
  policy_number text,
  policy_type text,
  sum_assured numeric not null default 0,
  currency text not null default 'UGX',
  start_date date,
  maturity_date date,
  premium numeric,
  premium_frequency text,
  status text not null default 'active',
  source text not null default 'ai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurance_bonuses (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.insurance_policies(id) on delete cascade,
  bonus_type text not null,
  amount numeric not null default 0,
  bonus_year text,
  created_at timestamptz not null default now()
);

create table if not exists public.insurance_documents (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.insurance_policies(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists insurance_policies_created_idx on public.insurance_policies(created_at desc);
create index if not exists insurance_bonuses_policy_idx on public.insurance_bonuses(policy_id);
create index if not exists insurance_documents_policy_idx on public.insurance_documents(policy_id);

alter table public.insurance_policies enable row level security;
alter table public.insurance_bonuses enable row level security;
alter table public.insurance_documents enable row level security;

drop policy if exists "insurance_policies_anon_all" on public.insurance_policies;
drop policy if exists "insurance_bonuses_anon_all" on public.insurance_bonuses;
drop policy if exists "insurance_documents_anon_all" on public.insurance_documents;

create policy "insurance_policies_anon_all"
  on public.insurance_policies for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "insurance_bonuses_anon_all"
  on public.insurance_bonuses for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "insurance_documents_anon_all"
  on public.insurance_documents for all
  to anon, authenticated
  using (true)
  with check (true);
