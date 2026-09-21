-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Duración de cada sesión de entrenamiento
-- Correr DESPUÉS de 0010_medidas.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Al tocar "Comenzar rutina" arranca un reloj; al terminar se guarda la
-- sesión (una por día de entreno y semana del bloque).
create table if not exists sesiones_entreno (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mesocycle_id uuid not null references mesocycles (id) on delete cascade,
  training_day_id uuid not null references training_days (id) on delete cascade,
  semana integer not null,
  inicio_at timestamptz not null,
  fin_at timestamptz not null,
  duracion_seg integer not null check (duracion_seg >= 0),
  series integer not null default 0,
  created_at timestamptz not null default now(),
  unique (mesocycle_id, training_day_id, semana)
);

create index if not exists sesiones_entreno_user_idx on sesiones_entreno (user_id, fin_at desc);

alter table sesiones_entreno enable row level security;
drop policy if exists sesiones_entreno_all on sesiones_entreno;
create policy sesiones_entreno_all on sesiones_entreno
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());
