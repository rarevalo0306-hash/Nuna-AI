-- Tope de almacenamiento por cuenta y límite de conversaciones que no bloquea ediciones.
-- Aplicada al proyecto de Supabase «Nuna-AI» el 2026-10-06.

-- Tamaño de cada conversación, calculado una vez al guardarla para que sumar el total de una cuenta sea barato.
alter table public.conversations add column bytes integer generated always as (octet_length(messages::text)) stored;

-- Máximo 2000 conversaciones y 50 MB por cuenta. Actualizar una conversación existente (incluido un upsert)
-- no cuenta como una nueva.
create or replace function private.limit_conversations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT'
     and not exists (select 1 from public.conversations c where c.owner = new.owner and c.id = new.id)
     and (select count(*) from public.conversations c where c.owner = new.owner) >= 2000 then
    raise exception 'conversation_limit' using errcode = 'P0001';
  end if;
  if (select coalesce(sum(c.bytes), 0) from public.conversations c where c.owner = new.owner and c.id <> new.id)
     + octet_length(new.messages::text) > 50000000 then
    raise exception 'storage_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace trigger conversations_limit before insert or update on public.conversations
for each row execute function private.limit_conversations();
