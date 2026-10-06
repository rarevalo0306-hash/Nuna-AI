-- Private binary files, classified by type under each account's ID.
insert into storage.buckets(id,name,public,file_size_limit) values ('nuna-files','nuna-files',false,10485760);
create policy nuna_files_read on storage.objects for select to authenticated using(bucket_id='nuna-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy nuna_files_upload on storage.objects for insert to authenticated with check(bucket_id='nuna-files' and (storage.foldername(name))[1]=(select auth.uid())::text and (storage.foldername(name))[2] in ('photos','videos','documents','audio','other'));
create policy nuna_files_delete on storage.objects for delete to authenticated using(bucket_id='nuna-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
