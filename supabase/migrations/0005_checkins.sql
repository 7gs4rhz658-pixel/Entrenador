-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Check-in semanal e informe
-- Correr DESPUÉS de 0004_asistente.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Al cerrar cada semana el cliente responde un check-in de un minuto.
-- Con eso y con sus registros reales la IA redacta un borrador de
-- informe que el entrenador aprueba (o edita) antes de que lo vea el
-- cliente.
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mesocycle_id uuid not null references mesocycles (id) on delete cascade,
  semana integer not null,
  fecha date not null default current_date,
  peso_kg numeric(5, 1),
  cintura_cm numeric(5, 1),
  energia integer check (energia between 1 and 5),
  sueno integer check (sueno between 1 and 5),
  adherencia integer check (adherencia between 1 and 5),
  comentario text not null default '',
  -- Números de la semana calculados al guardar (ver lib/stats.ts)
  resumen jsonb,
  -- Borrador de la IA y texto final aprobado por el entrenador
  informe jsonb,
  informe_estado text not null default 'pendiente'
    check (informe_estado in ('pendiente', 'borrador', 'aprobado')),
  informe_final text,
  aprobado_at timestamptz,
  visto_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mesocycle_id, semana)
);

create index if not exists checkins_user_idx on checkins (user_id, created_at desc);

alter table checkins enable row level security;

drop policy if exists checkins_all on checkins;
create policy checkins_all on checkins
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());
