create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own profile avatars read" on storage.objects;
drop policy if exists "own profile avatars insert" on storage.objects;
drop policy if exists "own profile avatars update" on storage.objects;
drop policy if exists "own profile avatars delete" on storage.objects;

create policy "own profile avatars read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "own profile avatars insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "own profile avatars update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "own profile avatars delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
