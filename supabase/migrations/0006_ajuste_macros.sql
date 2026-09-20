-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Ajuste quincenal de macros
-- Correr DESPUÉS de 0005_checkins.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Última vez que el entrenador aplicó (o descartó) el ajuste sugerido
-- de calorías según la tendencia de peso: no se vuelve a sugerir hasta
-- pasadas dos semanas.
alter table profiles add column if not exists ajuste_macros_at timestamptz;
