-- Registros creados mediante el atajo personal de iPhone.
alter type transaction_source add value if not exists 'shortcut';

-- Solo se persiste SHA-256 de la credencial. El valor original se muestra una
-- vez al usuario y se guarda exclusivamente en la app Atajos.
create table shortcut_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null default 'iPhone',
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create unique index shortcut_tokens_one_active_per_user
  on shortcut_tokens (user_id)
  where revoked_at is null;

create index shortcut_tokens_user_idx on shortcut_tokens (user_id);

alter table shortcut_tokens enable row level security;

grant select, insert, update, delete on table shortcut_tokens to authenticated;

create policy "own shortcut tokens"
  on shortcut_tokens for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Los tokens OAuth del MCP siguen siendo estrictamente de solo lectura.
create policy "oauth sessions cannot insert shortcut tokens"
  on shortcut_tokens as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot update shortcut tokens"
  on shortcut_tokens as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot delete shortcut tokens"
  on shortcut_tokens as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);
