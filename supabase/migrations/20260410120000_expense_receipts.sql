-- Receipt attachments on expenses + private storage bucket

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
