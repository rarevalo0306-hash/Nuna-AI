-- Plan «Administrador» sin restricciones y tope diario para las llamadas de fondo (títulos y memoria).
-- Aplicada al proyecto de Supabase «Nuna-AI» el 2026-10-09.
--
-- * Administrador: sin límite de mensajes, imágenes, videos ni voz, y con todos los modelos. El servidor lo trata
--   igual que una cuenta de NUNA_ADMIN_EMAILS. Se asigna como cualquier plan, en private.account_plans.
-- * Los títulos de conversación y la memoria no gastan mensajes, pero cada cuenta tiene un tope diario de esas
--   llamadas para que nadie pueda repetirlas sin fin a costa de NUNA.

insert into private.plans (id, name, daily_messages, paid_models, storage_gb, daily_images, daily_videos, daily_voice)
values ('administrador', 'Administrador', 1000000, true, null, 1000000, 1000000, 1000000);

create table private.ai_background_usage (
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (owner, day)
);
alter table private.ai_background_usage enable row level security;

-- Cuenta una llamada de fondo del día (UTC) si queda cupo. Lo llama el servidor con la sesión de la persona.
create function public.consume_ai_background(p_limit integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_used integer;
begin
  if auth.uid() is null or p_limit is null or p_limit < 1 or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'consume_ai_background: not allowed';
  end if;
  insert into private.ai_background_usage as b (owner, day, used) values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (owner, day) do update set used = b.used + 1 where b.used < p_limit
  returning b.used into v_used;
  return v_used is not null;
end $$;

revoke all on function public.consume_ai_background(integer) from public, anon;
grant execute on function public.consume_ai_background(integer) to authenticated;
