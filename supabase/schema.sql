-- Esquema propuesto para la fase con Supabase (autenticación y datos por usuario).
-- Todavía no está aplicado ni conectado: la app sigue guardando datos en el navegador.
-- Cada tabla usa Row Level Security para que cada persona solo vea sus propios datos.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  phone text,
  address text,
  contact_public boolean not null default false, -- los datos de contacto son privados por defecto
  preferred_model text,
  language text not null default 'es',
  theme text not null default 'dark',
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  owner uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  provider text,
  model text,
  created_at timestamptz not null default now()
);

-- Perfil profesional (Work). Los pagos de publicidad se gestionarán con un proveedor seguro:
-- aquí nunca se guardan números de tarjeta ni códigos de seguridad.
create table if not exists public.work_profiles (
  owner uuid primary key references auth.users on delete cascade,
  business_name text,
  profession text,
  services text,
  service_area text,
  contact text,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.work_profiles enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own projects" on public.projects for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "own conversations" on public.conversations for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "own messages" on public.messages for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "own work profile" on public.work_profiles for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "published work profiles are public" on public.work_profiles for select using (published);
