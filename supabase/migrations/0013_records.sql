-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Récords personales
-- Correr DESPUÉS de 0012_fotos_progreso.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Cada vez que una serie supera el máximo histórico del ejercicio (peso
-- en los que usan kg, repeticiones en los demás) queda un récord.
create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ejercicio text not null,
  tipo text not null check (tipo in ('peso', 'reps')),
  valor numeric(7, 2) not null,
  reps integer,
  anterior numeric(7, 2),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists records_user_idx on records (user_id, created_at desc);

alter table records enable row level security;
drop policy if exists records_all on records;
create policy records_all on records
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());
