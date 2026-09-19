-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Recomendación de comidas
-- Correr DESPUÉS de 0002_seed.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ── Perfil: cuestionario nutricional, macros a mano y descargo ──
-- macros_manual: {"entreno": {kcal,prot_g,carb_g,grasa_g}, "descanso": {...}}
-- Si está, pisa la fórmula de Mifflin para ese cliente.
alter table profiles add column if not exists cuestionario_nutricion jsonb;
alter table profiles add column if not exists macros_manual jsonb;
alter table profiles add column if not exists acepto_descargo_at timestamptz;

-- ── Recomendación de comidas (un menú de entreno + uno de descanso) ─
-- Es orientación del entrenador, no un plan de nutricionista: el
-- cliente acepta el descargo antes de verla.
create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null default 'Recomendación de comidas',
  origen text not null default 'ia' check (origen in ('ia', 'txt')),
  activo boolean not null default true,
  notas text,
  -- Guía de batch cooking calculada al aplicar (ver lib/meal-plan.ts)
  batch_cooking jsonb,
  created_at timestamptz not null default now()
);

-- Un solo plan activo por cliente
create unique index if not exists meal_plans_activo_uidx
  on meal_plans (user_id) where activo;

-- Cada fila es un ingrediente real (tabla ingredients) dentro de un
-- plato, para un tipo de día. Los macros salen de la tabla, no de la IA.
create table if not exists meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_plan_id uuid not null references meal_plans (id) on delete cascade,
  tipo_dia text not null check (tipo_dia in ('entreno', 'descanso')),
  momento text not null
    check (momento in ('desayuno', 'almuerzo', 'merienda', 'cena', 'snack')),
  orden integer not null default 1,
  plato text not null default '',
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  cantidad_g numeric(7, 1) not null check (cantidad_g > 0),
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists meal_plan_items_plan_idx
  on meal_plan_items (meal_plan_id, tipo_dia, momento, orden);

-- "La comí": el registro del día apunta al ítem del plan que lo generó
-- (null = registrado a mano). Sirve para marcar/desmarcar y para medir
-- adherencia.
alter table meal_logs
  add column if not exists plan_item_id uuid
    references meal_plan_items (id) on delete set null;

create index if not exists meal_logs_plan_item_idx
  on meal_logs (user_id, fecha, plan_item_id) where plan_item_id is not null;

-- ── RLS: dueño o entrenador, igual que el resto ─────────────────
alter table meal_plans enable row level security;
alter table meal_plan_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['meal_plans', 'meal_plan_items'] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format(
      'create policy %I_all on %I for all to authenticated
         using (user_id = auth.uid() or public.is_entrenador())
         with check (user_id = auth.uid() or public.is_entrenador())',
      t, t
    );
  end loop;
end $$;
