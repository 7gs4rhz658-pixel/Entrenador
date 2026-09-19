-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Asistente de situaciones
-- Correr DESPUÉS de 0003_recomendacion_comidas.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Cada consulta del cliente ("hoy tengo una fiesta...") con la respuesta
-- de la IA. `aplicado` marca la respuesta que el cliente eligió como
-- ajuste del día; el entrenador ve el historial en la ficha.
create table if not exists asistente_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  pregunta text not null,
  tipo text not null default 'otro',
  respuesta jsonb not null,
  aplicado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists asistente_logs_user_fecha_idx
  on asistente_logs (user_id, fecha desc, created_at desc);

alter table asistente_logs enable row level security;

drop policy if exists asistente_logs_all on asistente_logs;
create policy asistente_logs_all on asistente_logs
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());
