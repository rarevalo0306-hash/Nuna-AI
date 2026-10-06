-- Apply only after the R2 frontend is live. Existing files remain private and readable.
drop policy if exists nuna_files_upload on storage.objects;
