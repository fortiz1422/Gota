begin;

create table if not exists public.counterparty_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  default_category text null check (default_category is null or default_category in (
    'Supermercado', 'Alimentos', 'Restaurantes', 'Delivery', 'Kiosco y Varios',
    'Casa/Mantenimiento', 'Muebles y Hogar', 'Servicios del Hogar',
    'Auto/Combustible', 'Auto/Mantenimiento', 'Transporte', 'Salud', 'Farmacia',
    'Educación', 'Ropa e Indumentaria', 'Cuidado Personal', 'Suscripciones',
    'Regalos', 'Transferencias Familiares', 'Entretenimiento', 'Vacaciones',
    'Mascotas', 'Hijos', 'Cargos Bancarios', 'Otros', 'Pago de Tarjetas'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.counterparty_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  alias_value text not null check (char_length(alias_value) between 1 and 160),
  normalized_value text not null check (char_length(normalized_value) between 1 and 160),
  source text not null check (source in ('manual', 'receipt', 'parser')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_value),
  constraint counterparty_alias_profile_same_user
    foreign key (profile_id, user_id)
    references public.counterparty_profiles(id, user_id)
    on delete cascade
);

create index if not exists counterparty_profiles_name_idx
  on public.counterparty_profiles(user_id, lower(display_name));

create index if not exists counterparty_aliases_profile_idx
  on public.counterparty_aliases(profile_id);

alter table public.counterparty_profiles enable row level security;
alter table public.counterparty_aliases enable row level security;

create policy "counterparty_profiles_select_own" on public.counterparty_profiles
  for select using (auth.uid() = user_id);
create policy "counterparty_profiles_insert_own" on public.counterparty_profiles
  for insert with check (auth.uid() = user_id);
create policy "counterparty_profiles_update_own" on public.counterparty_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "counterparty_profiles_delete_own" on public.counterparty_profiles
  for delete using (auth.uid() = user_id);

create policy "counterparty_aliases_select_own" on public.counterparty_aliases
  for select using (auth.uid() = user_id);
create policy "counterparty_aliases_insert_own" on public.counterparty_aliases
  for insert with check (auth.uid() = user_id);
create policy "counterparty_aliases_update_own" on public.counterparty_aliases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "counterparty_aliases_delete_own" on public.counterparty_aliases
  for delete using (auth.uid() = user_id);

commit;
