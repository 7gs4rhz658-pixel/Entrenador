-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Rutinas del entrenador por fases
-- Correr DESPUÉS de 0017_menu_borrador.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Borrador de rutina: el plan completo queda en `plan` (jsonb) y recién
-- al enviarlo se escriben días, ejercicios y series. Así el cliente sigue
-- con su rutina mientras el entrenador arma la nueva.
alter table mesocycles add column if not exists plan jsonb;

-- Fases del plan del entrenador (semanas 1-4 oclusión, 5-8 fuerza…):
-- [{nombre, semana_desde, semana_hasta, objetivo, reglas[], tempo, descanso_seg, rir}]
alter table mesocycles add column if not exists fases jsonb not null default '[]';
alter table mesocycles add column if not exists notas text;
-- Lo que el texto dirige al entrenador (no lo ve el cliente)
alter table mesocycles add column if not exists notas_entrenador text;
-- 'ondulada': motor de 4 semanas (piso, tope, carga, descarga).
-- 'plan': respeta series y rangos del entrenador; sube el peso al llegar
-- al tope del rango en todas las series (sin descargas automáticas).
alter table mesocycles add column if not exists progresion text not null default 'ondulada';
alter table mesocycles drop constraint if exists mesocycles_progresion_check;
alter table mesocycles add constraint mesocycles_progresion_check check (progresion in ('ondulada', 'plan'));

-- Ejercicio dentro de su fase y cómo se ejecuta
alter table exercises add column if not exists semana_desde integer;   -- null = desde la semana 1
alter table exercises add column if not exists semana_hasta integer;   -- null = hasta el final
alter table exercises add column if not exists tempo jsonb;            -- {concentrico, contraccion, excentrico, estiramiento, texto}
alter table exercises add column if not exists parciales integer;      -- de las reps, cuántas son parciales al final
alter table exercises add column if not exists por_lado boolean not null default false;
alter table exercises add column if not exists superserie text;        -- mismo valor = se alternan
alter table exercises add column if not exists nota text;              -- indicación literal del plan
alter table exercises add column if not exists pasos jsonb not null default '[]';
alter table exercises add column if not exists clave text;             -- el punto técnico más importante
alter table exercises add column if not exists verbos jsonb;           -- {fuerza, regreso} para la guía de cadencia

-- Lecturas de la IA de rutinas y de técnica por ejercicio
alter table ia_lecturas drop constraint if exists ia_lecturas_tipo_check;
alter table ia_lecturas add constraint ia_lecturas_tipo_check check (tipo in ('menu', 'protocolo', 'rutina', 'tecnica'));
