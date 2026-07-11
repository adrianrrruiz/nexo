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
-- accounts
-- ---------------------------------------------------------------------------
create table accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  type            account_type not null default 'debit',
  currency        text not null default 'COP',
  initial_balance numeric(18, 2) not null default 0,
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

create policy "own accounts"       on accounts       for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories"     on categories     for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions"   on transactions   for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own import_batches" on import_batches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
