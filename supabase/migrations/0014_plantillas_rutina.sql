-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Plantillas de rutina del entrenador
-- Correr DESPUÉS de 0013_records.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Una rutina guardada para reutilizar con otros clientes (mismo formato
-- que un plan generado: días, ejercicios, series, rangos, descansos).
-- Solo la ven y editan los entrenadores.
create table if not exists plantillas_rutina (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null default '',
  plan jsonb not null,
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plantillas_rutina enable row level security;
drop policy if exists plantillas_rutina_entrenador on plantillas_rutina;
create policy plantillas_rutina_entrenador on plantillas_rutina
  for all to authenticated
  using (public.is_entrenador())
  with check (public.is_entrenador());
