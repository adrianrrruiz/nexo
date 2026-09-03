drop policy "own account statement files read" on storage.objects;
drop policy "own account statement files insert" on storage.objects;
drop policy "own account statement files delete" on storage.objects;

create policy "own account statement files read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'account-statements'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1 from accounts
    where accounts.id::text = (storage.foldername(storage.objects.name))[2]
      and accounts.user_id = (select auth.uid())
  )
);

create policy "own account statement files insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'account-statements'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and ((select auth.jwt()) ->> 'client_id') is null
  and exists (
    select 1 from accounts
    where accounts.id::text = (storage.foldername(storage.objects.name))[2]
      and accounts.user_id = (select auth.uid())
  )
);

create policy "own account statement files delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'account-statements'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and ((select auth.jwt()) ->> 'client_id') is null
  and exists (
    select 1 from accounts
    where accounts.id::text = (storage.foldername(storage.objects.name))[2]
      and accounts.user_id = (select auth.uid())
  )
);
