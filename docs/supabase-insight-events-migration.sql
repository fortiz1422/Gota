-- Lifecycle de señales de inteligencia (guía v1.1 §16).
-- Aditiva: el rollback de la feature no requiere revertirla; las filas
-- simplemente dejan de consultarse.
-- No guarda montos, merchants, tarjetas, cuentas ni descripciones.

create table if not exists insight_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  dedupe_key text not null,
  insight_kind text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  shown_count integer not null default 0,
  dismissed_until timestamptz,
  acted_at timestamptz,
  resolved_at timestamptz,
  feedback text check (feedback in ('useful', 'not_relevant', 'not_now')),
  last_status text check (last_status in ('calm', 'watch', 'risk')),
  surface text,
  primary key (user_id, dedupe_key)
);

alter table insight_events enable row level security;

create policy "insight_events_select_own" on insight_events
  for select using (auth.uid() = user_id);

create policy "insight_events_insert_own" on insight_events
  for insert with check (auth.uid() = user_id);

create policy "insight_events_update_own" on insight_events
  for update using (auth.uid() = user_id);

create policy "insight_events_delete_own" on insight_events
  for delete using (auth.uid() = user_id);
