-- Called with the user's session; RLS restricts this sum to their private files.
create or replace function public.account_file_bytes() returns bigint
language sql stable security invoker set search_path = '' as $$
 select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0)::bigint
 from storage.objects where bucket_id='nuna-files' and (storage.foldername(name))[1]=(select auth.uid())::text;
$$;
revoke all on function public.account_file_bytes() from public,anon;
grant execute on function public.account_file_bytes() to authenticated;
