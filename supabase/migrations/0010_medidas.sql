-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Medidas corporales
-- Correr DESPUÉS de 0009_revision_entrenador.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Una toma de medidas por fecha (cm). Todo opcional salvo la fecha: el
-- cliente carga las que tenga. Los brazos van relajados y contraídos.
create table if not exists medidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  peso_kg numeric(5, 1),
  cuello numeric(5, 1),
  hombros numeric(5, 1),
  pecho numeric(5, 1),
  cintura numeric(5, 1),
  cadera numeric(5, 1),
  brazo_izq numeric(5, 1),
  brazo_izq_contraido numeric(5, 1),
  brazo_der numeric(5, 1),
  brazo_der_contraido numeric(5, 1),
  antebrazo_izq numeric(5, 1),
  antebrazo_der numeric(5, 1),
  muslo_izq numeric(5, 1),
  muslo_der numeric(5, 1),
  pantorrilla_izq numeric(5, 1),
  pantorrilla_der numeric(5, 1),
  notas text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, fecha)
);

create index if not exists medidas_user_fecha_idx on medidas (user_id, fecha desc);

alter table medidas enable row level security;
drop policy if exists medidas_all on medidas;
create policy medidas_all on medidas
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());
