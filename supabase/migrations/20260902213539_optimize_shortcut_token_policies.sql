drop policy "oauth sessions cannot insert shortcut tokens" on shortcut_tokens;
drop policy "oauth sessions cannot update shortcut tokens" on shortcut_tokens;
drop policy "oauth sessions cannot delete shortcut tokens" on shortcut_tokens;

create policy "oauth sessions cannot insert shortcut tokens"
  on shortcut_tokens as restrictive for insert to authenticated
  with check (((select auth.jwt()) ->> 'client_id') is null);

create policy "oauth sessions cannot update shortcut tokens"
  on shortcut_tokens as restrictive for update to authenticated
  using (((select auth.jwt()) ->> 'client_id') is null)
  with check (((select auth.jwt()) ->> 'client_id') is null);

create policy "oauth sessions cannot delete shortcut tokens"
  on shortcut_tokens as restrictive for delete to authenticated
  using (((select auth.jwt()) ->> 'client_id') is null);
