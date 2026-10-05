insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('pattern-pdfs', 'pattern-pdfs', false, 20971520, array['application/pdf']),
  ('project-photos', 'project-photos', false, 5242880, array['image/jpeg']),
  ('yarn-photos', 'yarn-photos', false, 5242880, array['image/jpeg']);

create policy "own folder read" on storage.objects for select to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder update" on storage.objects for update to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own folder delete" on storage.objects for delete to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);
