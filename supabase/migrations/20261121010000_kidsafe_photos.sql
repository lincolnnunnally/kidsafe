-- Kid Safe's own photo storage (children and parents), so a photo's address never says FurFriend.
--
-- Public bucket, so the share page and scan page can show a photo by its long random address.
-- Deliberately NO public select policy (furfriend-photos had one until 2026-11-22): with one, anyone could list the
-- bucket and walk every child's photo. A parent can see, replace and delete only files in their own
-- folder (<uid>/...), the same folder rule as furfriend-photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kidsafe-photos',
  'kidsafe-photos',
  true,
  5242880,
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ks_photos_own_read on storage.objects;
create policy ks_photos_own_read on storage.objects for select to authenticated
  using (bucket_id = 'kidsafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ks_photos_insert on storage.objects;
create policy ks_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kidsafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ks_photos_update on storage.objects;
create policy ks_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'kidsafe-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'kidsafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ks_photos_delete on storage.objects;
create policy ks_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kidsafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
