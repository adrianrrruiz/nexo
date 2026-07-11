-- Nexo — esquema inicial (Fase 1: flujo de caja)
-- Un solo usuario por ahora, pero todo va ligado a auth.users + RLS para
-- que los datos queden aislados y el modelo escale sin rehacer nada.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type account_type as enum ('debit', 'savings', 'credit', 'cash');

-- income   : ingreso            (+ en account_id)
-- expense  : gasto              (- en account_id)
-- transfer : traspaso           (- en account_id, + en to_account_id)
-- adjustment: ajuste de saldo   (+/- en account_id, amount con signo)
create type transaction_type as enum ('income', 'expense', 'transfer', 'adjustment');

-- de dónde salió el registro
create type transaction_source as enum ('manual', 'import', 'email');

-- para clasificar el catálogo de categorías
create type category_kind as enum ('income', 'expense');

-- ---------------------------------------------------------------------------
-- Utilidad: mantener updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  type            account_type not null default 'debit',
  currency        text not null default 'COP',
  initial_balance numeric(18, 2) not null default 0,
  credit_limit    numeric(18, 2),
  image_path      text,
  color           text,
  icon            text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, name)
);

create trigger accounts_set_updated_at
  before update on accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (jerárquica: categoría -> subcategoría vía parent_id)
-- ---------------------------------------------------------------------------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  parent_id  uuid references categories (id) on delete cascade,
  kind       category_kind not null default 'expense',
  color      text,
  icon       text,
  created_at timestamptz not null default now(),
  unique (user_id, parent_id, name)
);

create index categories_user_idx on categories (user_id);
create index categories_parent_idx on categories (parent_id);

-- ---------------------------------------------------------------------------
-- import_batches (trazabilidad: permite deshacer una importación completa)
-- ---------------------------------------------------------------------------
create table import_batches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  source_file text,
  row_count   integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            transaction_type not null,
  amount          numeric(18, 2) not null,
  occurred_at     timestamptz not null default now(),
  account_id      uuid not null references accounts (id) on delete restrict,
  to_account_id   uuid references accounts (id) on delete restrict,
  category_id     uuid references categories (id) on delete set null,
  note            text,
  source          transaction_source not null default 'manual',
  external_ref    text,               -- clave para deduplicar (ej. correo)
  import_batch_id uuid references import_batches (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- reglas de integridad por tipo
  constraint transfer_needs_destination
    check (type <> 'transfer' or to_account_id is not null),
  constraint transfer_distinct_accounts
    check (to_account_id is null or to_account_id <> account_id),
  constraint non_transfer_no_destination
    check (type = 'transfer' or to_account_id is null)
);

create index transactions_user_idx on transactions (user_id);
create index transactions_occurred_idx on transactions (occurred_at desc);
create index transactions_account_idx on transactions (account_id);
create index transactions_to_account_idx on transactions (to_account_id);
create index transactions_category_idx on transactions (category_id);
create index transactions_batch_idx on transactions (import_batch_id);
-- evita importar dos veces el mismo movimiento (ej. de correo)
create unique index transactions_external_ref_uniq
  on transactions (user_id, external_ref)
  where external_ref is not null;

create trigger transactions_set_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Vista: saldo calculado por cuenta
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RLS: cada quien solo ve/toca lo suyo
-- ---------------------------------------------------------------------------
alter table accounts       enable row level security;
alter table categories     enable row level security;
alter table transactions   enable row level security;
alter table import_batches enable row level security;
alter table profiles       enable row level security;

create policy "own accounts"       on accounts       for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own categories"     on categories     for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own transactions"   on transactions   for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own import_batches" on import_batches for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own profile"        on profiles       for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-images',
  'account-images',
  false,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

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
