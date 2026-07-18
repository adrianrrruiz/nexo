-- Supabase OAuth access tokens are regular authenticated JWTs with a
-- client_id claim. Existing ownership policies must continue to allow the PWA
-- to write, while OAuth clients used by MCP remain read-only even if a token is
-- used directly against the Data API.

create policy "oauth sessions cannot insert accounts"
  on accounts as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot update accounts"
  on accounts as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot delete accounts"
  on accounts as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot insert categories"
  on categories as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot update categories"
  on categories as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot delete categories"
  on categories as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot insert transactions"
  on transactions as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot update transactions"
  on transactions as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot delete transactions"
  on transactions as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot insert import batches"
  on import_batches as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot update import batches"
  on import_batches as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot delete import batches"
  on import_batches as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot insert profiles"
  on profiles as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot update profiles"
  on profiles as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot delete profiles"
  on profiles as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

-- Apply the same restriction to all private storage buckets. Existing
-- ownership policies continue to decide which direct sessions can write.
create policy "oauth sessions cannot insert storage objects"
  on storage.objects as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot update storage objects"
  on storage.objects as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null)
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth sessions cannot delete storage objects"
  on storage.objects as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);
