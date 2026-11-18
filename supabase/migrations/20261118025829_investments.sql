-- The composite reference keeps a position linked to an account of its owner.
alter table public.accounts add constraint accounts_id_user_id_key unique (id, user_id);

create table public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  symbol text check (symbol ~ '^[A-Z0-9^][A-Z0-9.^=/_-]{0,31}$'),
  asset_type text not null check (asset_type in ('fund', 'stock', 'fixed_income', 'crypto', 'cash', 'real_estate', 'other')),
  quantity numeric(20,8) not null check (quantity between 0 and 9999999999),
  average_price numeric(20,8) check (average_price between 0 and 9999999999),
  cost_currency text not null check (cost_currency in ('COP', 'USD')),
  manual_price numeric(20,8) check (manual_price between 0 and 9999999999),
  manual_currency text not null check (manual_currency in ('COP', 'USD')),
  account_id uuid,
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id)
    on delete set null (account_id)
);

create index investment_positions_owner_idx on public.investment_positions (user_id, id);
create index investment_positions_account_idx on public.investment_positions (account_id, user_id)
  where account_id is not null;

create function public.set_investment_position_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger investment_positions_updated_at
  before update on public.investment_positions
  for each row execute function public.set_investment_position_updated_at();

create table public.investment_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  currency text not null check (currency in ('COP', 'USD'))
);

create table public.investment_market (
  user_id uuid primary key references auth.users (id) on delete cascade,
  quotes jsonb not null default '{}'::jsonb check (jsonb_typeof(quotes) = 'object'),
  usd_cop numeric(18,8) check (usd_cop > 0 and usd_cop < 1000000),
  rate_at timestamptz,
  checked_at timestamptz not null,
  check ((usd_cop is null) = (rate_at is null))
);

alter table public.investment_positions enable row level security;
alter table public.investment_preferences enable row level security;
alter table public.investment_market enable row level security;

revoke all on public.investment_positions, public.investment_preferences, public.investment_market
  from public, anon, authenticated;
grant select, insert, update, delete on public.investment_positions to authenticated;
grant select, insert, update on public.investment_preferences, public.investment_market to authenticated;

create policy "read own investment positions" on public.investment_positions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own investment positions" on public.investment_positions for insert to authenticated
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);
create policy "update own investment positions" on public.investment_positions for update to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);
create policy "delete own investment positions" on public.investment_positions for delete to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);

create policy "read own investment preferences" on public.investment_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own investment preferences" on public.investment_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);
create policy "update own investment preferences" on public.investment_preferences for update to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);

create policy "read own investment market" on public.investment_market for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own investment market" on public.investment_market for insert to authenticated
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);
create policy "update own investment market" on public.investment_market for update to authenticated
  using ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.uid()) = user_id and (select auth.jwt() ->> 'client_id') is null);
