create table account_statements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  account_id        uuid not null references accounts (id) on delete cascade,
  period            date not null check (extract(day from period) = 1),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_path      text not null unique,
  mime_type         text not null default 'application/pdf'
    check (mime_type = 'application/pdf'),
  size_bytes        bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  created_at        timestamptz not null default now()
);

create index account_statements_user_idx on account_statements (user_id);
create index account_statements_account_period_idx
  on account_statements (account_id, period desc, created_at desc);

alter table account_statements enable row level security;

grant select, insert, delete on table account_statements to authenticated;

create policy "own account statements read"
on account_statements for select
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from accounts
    where accounts.id = account_statements.account_id
      and accounts.user_id = (select auth.uid())
  )
);

create policy "own account statements insert"
on account_statements for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and ((select auth.jwt()) ->> 'client_id') is null
  and exists (
    select 1 from accounts
    where accounts.id = account_statements.account_id
      and accounts.user_id = (select auth.uid())
  )
);

create policy "own account statements delete"
on account_statements for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and ((select auth.jwt()) ->> 'client_id') is null
  and exists (
    select 1 from accounts
    where accounts.id = account_statements.account_id
      and accounts.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-statements',
  'account-statements',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "own account statement files read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'account-statements'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from accounts
    where accounts.id::text = (storage.foldername(name))[2]
      and accounts.user_id = (select auth.uid())
  )
);

create policy "own account statement files insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'account-statements'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and ((select auth.jwt()) ->> 'client_id') is null
  and exists (
    select 1 from accounts
    where accounts.id::text = (storage.foldername(name))[2]
      and accounts.user_id = (select auth.uid())
  )
);

create policy "own account statement files delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'account-statements'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and ((select auth.jwt()) ->> 'client_id') is null
  and exists (
    select 1 from accounts
    where accounts.id::text = (storage.foldername(name))[2]
      and accounts.user_id = (select auth.uid())
  )
);
