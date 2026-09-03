-- Los logos predeterminados son compartidos, pero el bucket sigue siendo
-- privado. Solo usuarios autenticados pueden solicitar URLs firmadas.
create policy "shared default account images read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'account-images'
  and (storage.foldername(name))[1] = 'defaults'
);
