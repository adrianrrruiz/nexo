-- Suscripciones recurrentes.
-- La suscripción solo guarda la plantilla del cobro (cuánto, de qué cuenta, con
-- qué categoría y cada cuánto). Cuando llega la fecha, la app la recomienda y
-- con un toque se crea un movimiento normal ligado por subscription_id.

create type subscription_frequency as enum (
  'weekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'yearly'
);

-- de dónde salió el registro: cobro confirmado desde una suscripción
alter type transaction_source add value if not exists 'subscription';

create table subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 80),
  amount          numeric(18, 2) not null check (amount > 0),
  account_id      uuid not null references accounts (id) on delete cascade,
  category_id     uuid references categories (id) on delete set null,
  frequency       subscription_frequency not null default 'monthly',
  -- primer cobro: fija el día de anclaje al avanzar de periodo
  started_on      date not null,
  next_charge_on  date not null,
  last_charged_on date,
  note            text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, name)
);

create index subscriptions_user_idx on subscriptions (user_id);
create index subscriptions_due_idx
  on subscriptions (user_id, next_charge_on)
  where active;
create index subscriptions_account_idx on subscriptions (account_id);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- trazabilidad: qué movimientos nacieron de qué suscripción
alter table transactions
  add column subscription_id uuid references subscriptions (id) on delete set null;

create index transactions_subscription_idx on transactions (subscription_id);

alter table subscriptions enable row level security;

grant select, insert, update, delete on table subscriptions to authenticated;

create policy "own subscriptions"
on subscriptions for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from accounts
    where accounts.id = subscriptions.account_id
      and accounts.user_id = (select auth.uid())
  )
  and (
    subscriptions.category_id is null
    or exists (
      select 1 from categories
      where categories.id = subscriptions.category_id
        and categories.user_id = (select auth.uid())
    )
  )
);

-- Los tokens OAuth del MCP siguen siendo estrictamente de solo lectura.
create policy "oauth sessions cannot insert subscriptions"
  on subscriptions as restrictive for insert to authenticated
  with check (((select auth.jwt()) ->> 'client_id') is null);

create policy "oauth sessions cannot update subscriptions"
  on subscriptions as restrictive for update to authenticated
  using (((select auth.jwt()) ->> 'client_id') is null)
  with check (((select auth.jwt()) ->> 'client_id') is null);

create policy "oauth sessions cannot delete subscriptions"
  on subscriptions as restrictive for delete to authenticated
  using (((select auth.jwt()) ->> 'client_id') is null);
