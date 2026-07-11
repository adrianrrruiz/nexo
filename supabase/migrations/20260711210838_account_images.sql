alter table accounts
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-images',
  'account-images',
  false,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own account images read" on storage.objects;
drop policy if exists "own account images insert" on storage.objects;
drop policy if exists "own account images update" on storage.objects;
drop policy if exists "own account images delete" on storage.objects;

create policy "own account images read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'account-images'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "own account images insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'account-images'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "own account images update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'account-images'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'account-images'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "own account images delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'account-images'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop view if exists account_balances;

create view account_balances
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.credit_limit,
  a.image_path,
  a.initial_balance
    + coalesce(sum(t.amount) filter (where t.type = 'income'     and t.account_id = a.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'    and t.account_id = a.id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'adjustment' and t.account_id = a.id), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'transfer'   and t.account_id = a.id), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'transfer'   and t.to_account_id = a.id), 0)
    as balance
from accounts a
left join transactions t
  on t.account_id = a.id or t.to_account_id = a.id
group by a.id;
