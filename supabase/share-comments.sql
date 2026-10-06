create table public.share_comments (
 id uuid primary key default gen_random_uuid(),
 share_id uuid not null references public.shared_conversations(id) on delete cascade,
 author uuid not null references auth.users(id) on delete cascade,
 author_name text not null check(length(author_name) between 1 and 60),
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index share_comments_share_time on public.share_comments(share_id,created_at);
alter table public.share_comments enable row level security;
revoke all on public.share_comments from anon,authenticated;
grant select(id,share_id,author_name,body,created_at) on public.share_comments to anon,authenticated;
grant insert(share_id,author,author_name,body) on public.share_comments to authenticated;
create policy comment_token_read on public.share_comments for select to anon,authenticated using (exists(select 1 from public.shared_conversations s where s.id=share_id and not s.revoked and s.id::text=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-nuna-share')));
create policy comment_signed_insert on public.share_comments for insert to authenticated with check ((select auth.uid())=author and exists(select 1 from public.shared_conversations s where s.id=share_id and not s.revoked and s.id::text=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-nuna-share')));
