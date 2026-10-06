-- NUNA AI: datos por cuenta y límite diario de mensajes de IA.
-- Cada persona solo puede leer y modificar sus propias filas (Row Level Security).
-- Aplicada al proyecto de Supabase «Nuna-AI» el 2026-10-06.
--
-- Avisos esperados del asesor de seguridad:
-- * private.ai_usage y private.ai_reservations tienen RLS sin políticas: nadie debe leerlas ni escribirlas directamente.
-- * consume_ai_message, refund_ai_message y ai_usage_today son SECURITY DEFINER y las puede llamar una sesión iniciada:
--   es intencionado. Solo cuentan o devuelven mensajes de la propia persona. Cualquiera con sesión puede llamar a
--   consume_ai_message directamente, pero eso solo gasta su propio cupo; devolver exige un identificador de reserva,
--   así que no permite recuperar más mensajes de los gastados.

-- Conversaciones: una fila por chat.
create table public.conversations (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  title text not null check (char_length(title) between 1 and 200),
  project text check (char_length(project) <= 64),
  messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(messages) = 'array' and octet_length(messages::text) <= 2000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

-- Proyectos, asignaciones de chats a proyectos y ejemplos ocultos.
create table public.user_state (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  projects jsonb not null default '[]'::jsonb
    check (jsonb_typeof(projects) = 'array' and octet_length(projects::text) <= 200000),
  assignments jsonb not null default '{}'::jsonb
    check (jsonb_typeof(assignments) = 'object' and octet_length(assignments::text) <= 200000),
  hidden jsonb not null default '[]'::jsonb
    check (jsonb_typeof(hidden) = 'array' and octet_length(hidden::text) <= 200000),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.user_state enable row level security;

revoke all on public.conversations, public.user_state from anon;
grant select, insert, update, delete on public.conversations, public.user_state to authenticated;

create policy "Read own conversations" on public.conversations for select to authenticated using ((select auth.uid()) = owner);
create policy "Create own conversations" on public.conversations for insert to authenticated with check ((select auth.uid()) = owner);
create policy "Update own conversations" on public.conversations for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "Delete own conversations" on public.conversations for delete to authenticated using ((select auth.uid()) = owner);

create policy "Read own state" on public.user_state for select to authenticated using ((select auth.uid()) = owner);
create policy "Create own state" on public.user_state for insert to authenticated with check ((select auth.uid()) = owner);
create policy "Update own state" on public.user_state for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "Delete own state" on public.user_state for delete to authenticated using ((select auth.uid()) = owner);

-- Tablas internas, fuera del esquema expuesto por la API: nadie puede escribirlas directamente.
create schema if not exists private;

create table private.ai_usage (
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (owner, day)
);

-- Una reserva por mensaje aceptado, para devolverlo si el proveedor falla.
create table private.ai_reservations (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now()
);
create index ai_reservations_owner_created on private.ai_reservations (owner, created_at);

alter table private.ai_usage enable row level security;
alter table private.ai_reservations enable row level security;

-- Máximo de conversaciones guardadas por cuenta.
create function private.limit_conversations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.conversations c where c.owner = new.owner) >= 2000 then
    raise exception 'conversation_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger conversations_limit before insert on public.conversations
for each row execute function private.limit_conversations();

-- Cuenta un mensaje del día (UTC) si queda cupo. Lo llama el servidor con la sesión de la persona.
create function public.consume_ai_message(p_limit integer)
returns table (ok boolean, used_today integer, day_limit integer, reservation_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_used integer;
  v_reservation uuid;
begin
  if v_owner is null or p_limit is null or p_limit < 1 or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'consume_ai_message: not allowed';
  end if;
  insert into private.ai_usage as u (owner, day, used) values (v_owner, v_day, 1)
  on conflict (owner, day) do update set used = u.used + 1 where u.used < p_limit
  returning u.used into v_used;
  if v_used is null then
    return query select false, p_limit, p_limit, null::uuid;
  else
    delete from private.ai_reservations r where r.owner = v_owner and r.created_at < now() - interval '10 minutes';
    insert into private.ai_reservations (owner, day) values (v_owner, v_day) returning id into v_reservation;
    return query select true, v_used, p_limit, v_reservation;
  end if;
end $$;

-- Devuelve un mensaje reservado cuando el proveedor no respondió. Solo sirve con el identificador
-- que recibió el servidor, durante 10 minutos y una sola vez.
create function public.refund_ai_message(p_reservation uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date;
begin
  delete from private.ai_reservations r
  where r.id = p_reservation and r.owner = auth.uid() and r.created_at > now() - interval '10 minutes'
  returning r.day into v_day;
  if v_day is null then
    return false;
  end if;
  update private.ai_usage u set used = greatest(u.used - 1, 0) where u.owner = auth.uid() and u.day = v_day;
  return true;
end $$;

-- Mensajes usados hoy (UTC) por la persona que llama.
create function public.ai_usage_today()
returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.used from private.ai_usage u where u.owner = auth.uid() and u.day = (now() at time zone 'utc')::date), 0);
$$;

revoke all on function public.consume_ai_message(integer), public.refund_ai_message(uuid), public.ai_usage_today() from public, anon;
grant execute on function public.consume_ai_message(integer), public.refund_ai_message(uuid), public.ai_usage_today() to authenticated;
revoke all on function private.limit_conversations() from public, anon, authenticated;
