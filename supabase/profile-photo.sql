create table public.profile_photos (
 owner uuid primary key references auth.users(id) on delete cascade,
 photo text not null default '' check(photo='' or (photo like 'data:image/jpeg;base64,%' and length(photo)<=120000)),
 updated_at timestamptz not null default now()
);
alter table public.profile_photos enable row level security;
revoke all on public.profile_photos from anon,authenticated;
grant select,insert,update on public.profile_photos to authenticated;
create policy profile_photo_read on public.profile_photos for select to authenticated using ((select auth.uid())=owner);
create policy profile_photo_insert on public.profile_photos for insert to authenticated with check ((select auth.uid())=owner);
create policy profile_photo_update on public.profile_photos for update to authenticated using ((select auth.uid())=owner) with check ((select auth.uid())=owner);
