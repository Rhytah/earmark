insert into storage.buckets (id, name, public)
values ('insurance-docs', 'insurance-docs', false)
on conflict (id) do nothing;

drop policy if exists "insurance_docs_select_all" on storage.objects;
drop policy if exists "insurance_docs_insert_all" on storage.objects;

create policy "insurance_docs_select_all"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'insurance-docs');

create policy "insurance_docs_insert_all"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'insurance-docs');
