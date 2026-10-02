-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Menú: borrador y enviado a la vez
-- Correr DESPUÉS de 0016_alimentos_mx_y_fases.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Antes había un solo menú activo por cliente: guardar un borrador (para
-- editar o ajustar el menú) le quitaba al cliente el que ya tenía hasta
-- que el entrenador lo enviaba. Ahora conviven uno enviado y un borrador,
-- como en los protocolos; al enviar, el borrador reemplaza al enviado.
drop index if exists meal_plans_activo_uidx;
create unique index if not exists meal_plans_publicado_uidx
  on meal_plans (user_id) where activo and publicado;
create unique index if not exists meal_plans_borrador_uidx
  on meal_plans (user_id) where activo and not publicado;
