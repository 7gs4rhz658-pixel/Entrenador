-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Vencimiento del pago mensual
-- Correr DESPUÉS de 0006_ajuste_macros.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Cada pago (o "marcar pagado" del entrenador) cubre 30 días. Vencido,
-- el cliente sigue viendo su rutina e historial pero no cierra semanas,
-- no crea bloques nuevos ni recibe informes hasta renovar.
alter table profiles add column if not exists pago_vence_at date;
alter table profiles add column if not exists pagado_at timestamptz;
