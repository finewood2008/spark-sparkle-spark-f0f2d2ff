
-- Create public bucket for article illustration images
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

-- Authenticated users can upload to their own folder (path prefix = user id)
create policy "Users can upload own article images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'article-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read for the bucket
create policy "Public can read article images"
on storage.objects for select
to public
using (bucket_id = 'article-images');

-- Owners can delete their own images
create policy "Users can delete own article images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'article-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
