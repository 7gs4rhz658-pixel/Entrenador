-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Esquema multi-cliente
-- Cada fila pertenece a un usuario de Supabase Auth (user_id) y la
-- seguridad la impone Row Level Security: un cliente solo ve lo suyo,
-- el entrenador ve y edita todo.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Entrenadores autorizados ────────────────────────────────────
-- Todo correo listado acá recibe el rol 'entrenador' al registrarse.
create table if not exists entrenadores (
  email text primary key
);

-- ── Perfiles (1 por usuario de auth.users) ──────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null default '',
  rol text not null default 'cliente' check (rol in ('cliente', 'entrenador')),
  edad integer,
  sexo text check (sexo in ('masculino', 'femenino')),
  peso_kg numeric(5, 1),
  altura_cm numeric(5, 1),
  nivel_actividad text not null default 'ligero'
    check (nivel_actividad in ('sedentario', 'ligero', 'moderado', 'alto')),
  objetivo text not null default 'superavit'
    check (objetivo in ('deficit', 'mantenimiento', 'superavit')),
  cuestionario jsonb,
  onboarding_completo boolean not null default false,
  estado_pago text not null default 'pendiente'
    check (estado_pago in ('pendiente', 'pagado')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ¿El usuario de la sesión es entrenador? (security definer para poder
-- consultarlo desde las políticas sin recursión)
create or replace function public.is_entrenador()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'entrenador'
  );
$$;

-- Perfil automático al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    case
      when exists (select 1 from public.entrenadores where lower(email) = lower(new.email))
        then 'entrenador'
      else 'cliente'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Un cliente no puede cambiarse el rol a sí mismo
create or replace function public.proteger_rol()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.rol is distinct from old.rol and not public.is_entrenador() then
    raise exception 'No podés cambiar el rol.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_proteger_rol on profiles;
create trigger profiles_proteger_rol
  before update on profiles
  for each row execute procedure public.proteger_rol();

-- ── Bloques de 8 semanas (2 ciclos ondulados de 4) ──────────────
create table if not exists mesocycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  fecha_inicio date not null default current_date,
  total_semanas integer not null default 8,
  semana_actual integer not null default 1,
  estado text not null default 'activo'
    check (estado in ('activo', 'finalizado')),
  origen text not null default 'ia'
    check (origen in ('ia', 'txt', 'plantilla', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists mesocycles_user_idx on mesocycles (user_id, created_at desc);

-- ── Días de la semana (1 = lunes ... 7 = domingo) ───────────────
create table if not exists training_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dia_semana integer not null check (dia_semana between 1 and 7),
  nombre text,
  es_descanso boolean not null default true,
  unique (user_id, dia_semana)
);

-- ── Ejercicios ──────────────────────────────────────────────────
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  training_day_id uuid not null references training_days (id) on delete cascade,
  nombre text not null,
  grupo_muscular text,
  descripcion text,
  tips jsonb not null default '[]',
  tipo text not null default 'aislamiento'
    check (tipo in ('compuesto', 'aislamiento')),
  progresion text not null default 'aislamiento'
    check (progresion in ('compuesto', 'aislamiento', 'solo_reps', 'al_fallo')),
  unidad text not null default 'kg'
    check (unidad in ('kg', 'peso_corporal', 'sin_peso')),
  incremento_kg numeric(4, 2) not null default 2.5,
  rep_min integer,
  rep_max integer,
  descanso_seg integer not null default 90 check (descanso_seg between 0 and 600),
  orden integer not null default 0,
  activo boolean not null default true
);

create index if not exists exercises_user_idx on exercises (user_id, activo);
create index if not exists exercises_dia_idx on exercises (training_day_id);

-- ── Plan por semana (series × reps × peso planificados) ─────────
create table if not exists planned_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mesocycle_id uuid not null references mesocycles (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  semana integer not null check (semana between 1 and 12),
  series integer not null check (series between 1 and 12),
  reps integer,
  peso_kg numeric(6, 2),
  al_fallo boolean not null default false,
  rir_objetivo integer,
  nota_ia text,
  unique (mesocycle_id, exercise_id, semana)
);

create index if not exists planned_sets_semana_idx
  on planned_sets (mesocycle_id, semana);

-- ── Series realizadas (editable serie por serie) ────────────────
create table if not exists logged_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mesocycle_id uuid not null references mesocycles (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  semana integer not null check (semana between 1 and 12),
  serie integer not null check (serie between 1 and 20),
  reps integer,
  peso_kg numeric(6, 2),
  rir integer,
  al_fallo boolean not null default false,
  descanso_seg integer,
  completado boolean not null default true,
  logged_at timestamptz not null default now(),
  unique (mesocycle_id, exercise_id, semana, serie)
);

create index if not exists logged_sets_semana_idx
  on logged_sets (mesocycle_id, semana);
create index if not exists logged_sets_ejercicio_idx
  on logged_sets (mesocycle_id, exercise_id);
create index if not exists logged_sets_user_fecha_idx
  on logged_sets (user_id, logged_at desc);

-- ── Semanas cerradas (para saber cuándo recalcular) ─────────────
create table if not exists week_closures (
  user_id uuid not null references auth.users (id) on delete cascade,
  mesocycle_id uuid not null references mesocycles (id) on delete cascade,
  semana integer not null,
  cerrada_at timestamptz not null default now(),
  primary key (mesocycle_id, semana)
);

-- ── Nutrición: ingredientes (macros por 100 g) ──────────────────
-- Compartidos entre todos los usuarios. Vienen de Open Food Facts
-- (fuente 'off', con su código de barras) o de la base USDA ('usda'),
-- o los carga a mano el entrenador ('manual').
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text,
  fuente text not null default 'off' check (fuente in ('off', 'usda', 'manual')),
  off_code text unique,
  kcal_100 numeric(7, 1) not null,
  prot_100 numeric(6, 1) not null default 0,
  carb_100 numeric(6, 1) not null default 0,
  grasa_100 numeric(6, 1) not null default 0,
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ingredients_nombre_idx on ingredients (lower(nombre));
-- Los ingredientes que no vienen de OFF no se duplican por nombre
create unique index if not exists ingredients_nombre_fuente_uidx
  on ingredients (lower(nombre)) where fuente <> 'off';

-- ── Nutrición: registro de comidas ──────────────────────────────
create table if not exists meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  momento text not null default 'almuerzo'
    check (momento in ('desayuno', 'almuerzo', 'merienda', 'cena', 'snack')),
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  cantidad_g numeric(7, 1) not null check (cantidad_g > 0),
  created_at timestamptz not null default now()
);

create index if not exists meal_logs_user_fecha_idx on meal_logs (user_id, fecha);

-- ── Seguridad: RLS ──────────────────────────────────────────────
alter table entrenadores enable row level security;
alter table profiles enable row level security;
alter table mesocycles enable row level security;
alter table training_days enable row level security;
alter table exercises enable row level security;
alter table planned_sets enable row level security;
alter table logged_sets enable row level security;
alter table week_closures enable row level security;
alter table ingredients enable row level security;
alter table meal_logs enable row level security;

-- entrenadores: solo lectura para el propio entrenador
drop policy if exists entrenadores_select on entrenadores;
create policy entrenadores_select on entrenadores
  for select to authenticated using (public.is_entrenador());

-- profiles: el propio perfil, o todos si es entrenador
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated using (id = auth.uid() or public.is_entrenador());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update to authenticated
  using (id = auth.uid() or public.is_entrenador())
  with check (id = auth.uid() or public.is_entrenador());

-- Tablas con user_id: dueño o entrenador, para todo
do $$
declare t text;
begin
  foreach t in array array[
    'mesocycles', 'training_days', 'exercises', 'planned_sets',
    'logged_sets', 'week_closures', 'meal_logs'
  ] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format(
      'create policy %I_all on %I for all to authenticated
         using (user_id = auth.uid() or public.is_entrenador())
         with check (user_id = auth.uid() or public.is_entrenador())',
      t, t
    );
  end loop;
end $$;

-- ingredients: los lee cualquiera logueado; los crea cualquiera (caché
-- de Open Food Facts); solo el entrenador edita o borra.
drop policy if exists ingredients_select on ingredients;
create policy ingredients_select on ingredients
  for select to authenticated using (true);
drop policy if exists ingredients_insert on ingredients;
create policy ingredients_insert on ingredients
  for insert to authenticated with check (true);
drop policy if exists ingredients_update on ingredients;
create policy ingredients_update on ingredients
  for update to authenticated using (public.is_entrenador());
drop policy if exists ingredients_delete on ingredients;
create policy ingredients_delete on ingredients
  for delete to authenticated using (public.is_entrenador());

-- ── Endurecimiento (advisors de Supabase) ───────────────────────
-- El trigger de alta de perfil solo lo ejecuta el servicio de Auth y
-- is_entrenador() no es invocable sin sesión.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
revoke execute on function public.is_entrenador() from public, anon;
grant execute on function public.is_entrenador() to authenticated;
