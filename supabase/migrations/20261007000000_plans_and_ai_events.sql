-- Planes de NUNA (Gratis, Plus, Pro) y registro de tokens y coste estimado de cada respuesta de IA.
-- Aplicada al proyecto de Supabase «Nuna-AI» el 2026-10-07.
--
-- Los límites viven en la base de datos (no llegan desde el navegador). Las cuentas sin plan asignado son «gratis».
-- Los administradores siguen definidos en NUNA_ADMIN_EMAILS (servidor) y no tienen límite.

create table private.plans (
  id text primary key check (id ~ '^[a-z]{2,20}$'),
  name text not null check (char_length(name) <= 40),
  daily_messages integer not null check (daily_messages >= 0),
  -- false: solo el modelo económico del plan gratuito (NUNA_FREE_MODEL); true: el modelo que la persona elija.
  paid_models boolean not null default false,
  storage_gb numeric(8, 2) check (storage_gb >= 0),
  updated_at timestamptz not null default now()
);
insert into private.plans (id, name, daily_messages, paid_models, storage_gb) values
  ('gratis', 'Gratis', 30, false, 2),
  ('plus', 'Plus', 150, true, null),
  ('pro', 'Pro', 500, true, null);

-- Plan de cada cuenta. Sin fila = gratis. Solo se asigna desde el panel de Supabase o con SQL (no hay API pública).
create table private.account_plans (
  owner uuid primary key references auth.users (id) on delete cascade,
  plan text not null references private.plans (id),
  note text check (char_length(note) <= 200),
  updated_at timestamptz not null default now()
);

-- Una fila por respuesta de IA: tokens reales que devolvió el proveedor y coste estimado con la tabla de precios del servidor.
-- Sin contenido de los mensajes.
create table private.ai_events (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('chat', 'image', 'video', 'voice')),
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 100),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cost_usd numeric(12, 6) check (cost_usd >= 0 and cost_usd < 100)
);
create index ai_events_owner_created on private.ai_events (owner, created_at);
create index ai_events_created on private.ai_events (created_at);

alter table private.plans enable row level security;
alter table private.account_plans enable row level security;
alter table private.ai_events enable row level security;

-- Plan y límites de la persona que llama.
create function public.my_plan()
returns table (plan text, plan_name text, daily_messages integer, paid_models boolean, storage_gb numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.daily_messages, p.paid_models, p.storage_gb
  from private.plans p
  where p.id = coalesce((select a.plan from private.account_plans a where a.owner = auth.uid()), 'gratis');
$$;

-- Registra una respuesta de la persona que llama. Lo llama el servidor con la sesión de la persona: alguien que lo llame
-- directamente solo puede añadir filas a su propio historial, y como mucho 5.000 al día.
create function public.log_ai_event(p_kind text, p_provider text, p_model text, p_input integer, p_output integer, p_cost numeric)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'log_ai_event: not allowed';
  end if;
  if (select count(*) from private.ai_events e where e.owner = auth.uid() and e.created_at > now() - interval '1 day') >= 5000 then
    return;
  end if;
  insert into private.ai_events (owner, kind, provider, model, input_tokens, output_tokens, cost_usd)
  values (auth.uid(), p_kind, left(p_provider, 40), left(p_model, 100), p_input, p_output, p_cost);
end $$;

revoke all on function public.my_plan(), public.log_ai_event(text, text, text, integer, integer, numeric) from public, anon;
grant execute on function public.my_plan(), public.log_ai_event(text, text, text, integer, integer, numeric) to authenticated;
