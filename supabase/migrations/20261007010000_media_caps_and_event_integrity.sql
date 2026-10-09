-- Límites diarios de imágenes, videos y sesiones de voz por plan, y registro de costes ligado a mensajes reales.
-- Aplicada al proyecto de Supabase «Nuna-AI» el 2026-10-07.
--
-- * Imágenes, videos y voz usan modelos de pago: cada plan tiene su propio tope diario para cada uno, además del
--   cupo de mensajes (que también gastan). Gratis: 0. Son topes de seguridad hasta que existan los créditos.
-- * record_ai_event sustituye a log_ai_event: solo acepta una fila por mensaje que el servidor reservó para esa persona
--   en los últimos 10 minutos, y guarda el plan que tenía la cuenta en ese momento.
-- * Sin «drop»: my_plan() y log_ai_event() quedan en la base de datos sin uso (log_ai_event, además, sin permisos).
--   Se pueden borrar a mano desde el panel de Supabase.

alter table private.plans
  add column daily_images integer not null default 0 check (daily_images >= 0),
  add column daily_videos integer not null default 0 check (daily_videos >= 0),
  add column daily_voice integer not null default 0 check (daily_voice >= 0);
update private.plans set daily_images = 10, daily_videos = 1, daily_voice = 2 where id = 'plus';
update private.plans set daily_images = 30, daily_videos = 3, daily_voice = 5 where id = 'pro';

create table private.ai_media_usage (
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('image', 'video', 'voice')),
  used integer not null default 0 check (used >= 0),
  primary key (owner, day, kind)
);
alter table private.ai_media_usage enable row level security;

-- Tipo de cada reserva, para devolver también el contador de imágenes, videos o voz.
alter table private.ai_reservations add column kind text not null default 'chat' check (kind in ('chat', 'image', 'video', 'voice'));

-- Igual que my_plan(), con los topes de imágenes, videos y voz.
create function public.my_plan_limits()
returns table (plan text, plan_name text, daily_messages integer, paid_models boolean, storage_gb numeric,
               daily_images integer, daily_videos integer, daily_voice integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.daily_messages, p.paid_models, p.storage_gb, p.daily_images, p.daily_videos, p.daily_voice
  from private.plans p
  where p.id = coalesce((select a.plan from private.account_plans a where a.owner = auth.uid()), 'gratis');
$$;

-- Cuenta una imagen, un video o una sesión de voz si quedan cupo de ese tipo y cupo de mensajes. Lo llama el servidor
-- con la sesión de la persona y los límites de su plan; alguien que lo llame directamente solo gasta su propio cupo.
create function public.consume_ai_media(p_kind text, p_limit integer, p_kind_limit integer)
returns table (ok boolean, used_today integer, day_limit integer, reservation_id uuid, kind_limit_reached boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_used integer;
  v_kind_used integer;
  v_reservation uuid;
begin
  if v_owner is null or p_kind is null or p_kind not in ('image', 'video', 'voice') or p_limit is null or p_limit < 1
     or p_kind_limit is null or p_kind_limit < 1 or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'consume_ai_media: not allowed';
  end if;
  insert into private.ai_media_usage as m (owner, day, kind, used) values (v_owner, v_day, p_kind, 1)
  on conflict (owner, day, kind) do update set used = m.used + 1 where m.used < p_kind_limit
  returning m.used into v_kind_used;
  if v_kind_used is null then
    return query select false, coalesce((select u.used from private.ai_usage u where u.owner = v_owner and u.day = v_day), 0), p_limit, null::uuid, true;
    return;
  end if;
  insert into private.ai_usage as u (owner, day, used) values (v_owner, v_day, 1)
  on conflict (owner, day) do update set used = u.used + 1 where u.used < p_limit
  returning u.used into v_used;
  if v_used is null then
    update private.ai_media_usage m set used = greatest(m.used - 1, 0) where m.owner = v_owner and m.day = v_day and m.kind = p_kind;
    return query select false, p_limit, p_limit, null::uuid, false;
    return;
  end if;
  -- Las reservas de más de 10 minutos las limpia consume_ai_message en el siguiente mensaje de chat.
  insert into private.ai_reservations (owner, day, kind) values (v_owner, v_day, p_kind) returning id into v_reservation;
  return query select true, v_used, p_limit, v_reservation, false;
end $$;

-- Igual que antes, pero también devuelve el contador de imágenes, videos o voz de la reserva.
create or replace function public.refund_ai_message(p_reservation uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date;
  v_kind text;
begin
  delete from private.ai_reservations r
  where r.id = p_reservation and r.owner = auth.uid() and r.created_at > now() - interval '10 minutes'
  returning r.day, r.kind into v_day, v_kind;
  if v_day is null then
    return false;
  end if;
  update private.ai_usage u set used = greatest(u.used - 1, 0) where u.owner = auth.uid() and u.day = v_day;
  if v_kind <> 'chat' then
    update private.ai_media_usage m set used = greatest(m.used - 1, 0) where m.owner = auth.uid() and m.day = v_day and m.kind = v_kind;
  end if;
  return true;
end $$;

-- Una fila de coste por mensaje reservado, con el plan de la cuenta en ese momento.
alter table private.ai_events add column reservation uuid unique, add column plan text check (char_length(plan) <= 20);

revoke all on function public.log_ai_event(text, text, text, integer, integer, numeric) from authenticated, public, anon;
create function public.record_ai_event(p_reservation uuid, p_kind text, p_provider text, p_model text, p_input integer, p_output integer, p_cost numeric)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'record_ai_event: not allowed';
  end if;
  -- Solo para un mensaje que el servidor reservó para esta persona hace menos de 10 minutos, del mismo tipo, una vez.
  if not exists (select 1 from private.ai_reservations r where r.id = p_reservation and r.owner = auth.uid()
                 and r.kind = p_kind and r.created_at > now() - interval '10 minutes') then
    return;
  end if;
  if (select count(*) from private.ai_events e where e.owner = auth.uid() and e.created_at > now() - interval '1 day') >= 5000 then
    return;
  end if;
  insert into private.ai_events (owner, reservation, plan, kind, provider, model, input_tokens, output_tokens, cost_usd)
  values (auth.uid(), p_reservation, coalesce((select a.plan from private.account_plans a where a.owner = auth.uid()), 'gratis'),
          p_kind, left(p_provider, 40), left(p_model, 100), p_input, p_output,
          case when p_cost >= 0 and p_cost <= 10 then p_cost end)
  on conflict (reservation) do nothing;
end $$;

revoke all on function public.my_plan_limits(), public.consume_ai_media(text, integer, integer),
  public.record_ai_event(uuid, text, text, text, integer, integer, numeric) from public, anon;
grant execute on function public.my_plan_limits(), public.consume_ai_media(text, integer, integer),
  public.record_ai_event(uuid, text, text, text, integer, integer, numeric) to authenticated;
