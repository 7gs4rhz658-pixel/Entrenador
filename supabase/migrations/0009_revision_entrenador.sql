-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Revisión del entrenador antes de publicar
-- Correr DESPUÉS de 0008_mensajes_push_referidos.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- La rutina y el menú nuevos quedan como borrador (publicado = false)
-- hasta que el entrenador los envía; el cliente solo ve lo publicado.
alter table mesocycles add column if not exists publicado boolean not null default true;
alter table mesocycles add column if not exists publicado_at timestamptz;
alter table meal_plans add column if not exists publicado boolean not null default true;
alter table meal_plans add column if not exists publicado_at timestamptz;
