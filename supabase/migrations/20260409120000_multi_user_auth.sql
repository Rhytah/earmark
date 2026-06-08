-- Multi-user: each signed-in user only sees their own data.

-- ── user_id on all app tables ───────────────────────────────────────────────

alter table public.expenses
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.expenses alter column user_id set default auth.uid();
create index if not exists expenses_user_id_idx on public.expenses(user_id);

alter table public.gym_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.gym_sessions alter column user_id set default auth.uid();
create index if not exists gym_sessions_user_id_idx on public.gym_sessions(user_id);

alter table public.savings_snapshots
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.savings_snapshots alter column user_id set default auth.uid();

alter table public.investment_transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.investment_transactions alter column user_id set default auth.uid();
create index if not exists investment_transactions_user_id_idx on public.investment_transactions(user_id);

alter table public.insurance_policies
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.insurance_policies alter column user_id set default auth.uid();
create index if not exists insurance_policies_user_id_idx on public.insurance_policies(user_id);

-- Legacy single-user rows (no owner) are dropped before composite / user PKs.
delete from public.savings_snapshots where user_id is null;
alter table public.savings_snapshots drop constraint if exists savings_snapshots_pkey;
alter table public.savings_snapshots add primary key (user_id, month);

alter table public.app_settings
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.app_settings alter column user_id set default auth.uid();

delete from public.app_settings where user_id is null;
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings drop column if exists id;
alter table public.app_settings add primary key (user_id);

-- ── RLS: authenticated users, own rows only ─────────────────────────────────

drop policy if exists "expenses_anon_all" on public.expenses;
drop policy if exists "expenses_user_own" on public.expenses;
create policy "expenses_user_own"
  on public.expenses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "gym_sessions_anon_all" on public.gym_sessions;
drop policy if exists "gym_sessions_user_own" on public.gym_sessions;
create policy "gym_sessions_user_own"
  on public.gym_sessions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "savings_snapshots_anon_all" on public.savings_snapshots;
drop policy if exists "savings_snapshots_user_own" on public.savings_snapshots;
create policy "savings_snapshots_user_own"
  on public.savings_snapshots for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "investment_transactions_anon_all" on public.investment_transactions;
drop policy if exists "investment_transactions_user_own" on public.investment_transactions;
create policy "investment_transactions_user_own"
  on public.investment_transactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "insurance_policies_anon_all" on public.insurance_policies;
drop policy if exists "insurance_policies_user_own" on public.insurance_policies;
create policy "insurance_policies_user_own"
  on public.insurance_policies for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "insurance_bonuses_anon_all" on public.insurance_bonuses;
drop policy if exists "insurance_bonuses_user_own" on public.insurance_bonuses;
create policy "insurance_bonuses_user_own"
  on public.insurance_bonuses for all to authenticated
  using (
    exists (
      select 1 from public.insurance_policies p
      where p.id = policy_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.insurance_policies p
      where p.id = policy_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "insurance_documents_anon_all" on public.insurance_documents;
drop policy if exists "insurance_documents_user_own" on public.insurance_documents;
create policy "insurance_documents_user_own"
  on public.insurance_documents for all to authenticated
  using (
    exists (
      select 1 from public.insurance_policies p
      where p.id = policy_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.insurance_policies p
      where p.id = policy_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "app_settings_anon_all" on public.app_settings;
drop policy if exists "app_settings_user_own" on public.app_settings;
create policy "app_settings_user_own"
  on public.app_settings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Storage: files under {user_id}/... ──────────────────────────────────────

drop policy if exists "insurance_docs_select_all" on storage.objects;
drop policy if exists "insurance_docs_insert_all" on storage.objects;
drop policy if exists "insurance_docs_select_own" on storage.objects;
drop policy if exists "insurance_docs_insert_own" on storage.objects;

create policy "insurance_docs_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'insurance-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "insurance_docs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'insurance-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
