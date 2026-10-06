-- Explicitly shared snapshots only. A token in a request header authorizes one snapshot,
-- never the owner's private conversations or a list of other shared chats.
create table if not exists public.shared_conversations (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null references auth.users(id) on delete cascade,
 conversation_id text not null check(length(conversation_id) between 1 and 100),
 title text not null check(length(title) <= 160),
 messages jsonb not null check(jsonb_typeof(messages)='array' and octet_length(messages::text)<=1000000),
 revoked boolean not null default false,
 created_at timestamptz not null default now(),
 unique(owner,conversation_id)
);
alter table public.shared_conversations enable row level security;
revoke all on public.shared_conversations from anon,authenticated;
grant select(id,title,messages,revoked,created_at) on public.shared_conversations to anon;
grant select,insert,update on public.shared_conversations to authenticated;
create policy share_owner_read on public.shared_conversations for select to authenticated using ((select auth.uid())=owner);
create policy share_token_read on public.shared_conversations for select to anon,authenticated using (not revoked and id::text=(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-nuna-share'));
create policy share_owner_insert on public.shared_conversations for insert to authenticated with check ((select auth.uid())=owner);
create policy share_owner_update on public.shared_conversations for update to authenticated using ((select auth.uid())=owner) with check ((select auth.uid())=owner);
