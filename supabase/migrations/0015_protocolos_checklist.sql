-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Checklist de "Hoy" y protocolos
-- Correr DESPUÉS de 0014_plantillas_rutina.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Casillas marcadas del checklist diario. Solo lo que no tiene otro
-- registro: agua e ítems del protocolo. Las comidas salen de meal_logs y
-- el entreno de logged_sets.
create table if not exists checklist_dia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  item_key text not null check (char_length(item_key) between 1 and 80),
  hecho_at timestamptz not null default now(),
  unique (user_id, fecha, item_key)
);

create index if not exists checklist_dia_user_fecha_idx on checklist_dia (user_id, fecha);

alter table checklist_dia enable row level security;
drop policy if exists checklist_dia_all on checklist_dia;
create policy checklist_dia_all on checklist_dia
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());

-- Protocolo del entrenador por segmentos (suplementos, hábitos, cara,
-- cabello…): lo que no es comida ni entreno, ubicado en el horario del
-- cliente. Por cliente puede haber uno publicado (el que ve) y un
-- borrador (el que el entrenador está editando); "Enviar" reemplaza.
create table if not exists protocolos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null default 'Protocolo',
  origen text not null default 'manual' check (origen in ('manual', 'txt')),
  activo boolean not null default true,
  publicado boolean not null default false,
  publicado_at timestamptz,
  fecha_inicio date,
  fuera_protocolo text[] not null default '{}',
  notas text,
  created_at timestamptz not null default now()
);

create unique index if not exists protocolos_publicado_uidx
  on protocolos (user_id) where activo and publicado;
create unique index if not exists protocolos_borrador_uidx
  on protocolos (user_id) where activo and not publicado;

create table if not exists protocolo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  protocolo_id uuid not null references protocolos (id) on delete cascade,
  segmento text not null check (char_length(segmento) between 1 and 40),
  titulo text not null check (char_length(titulo) between 1 and 120),
  detalle text not null default '',
  porque text,
  -- Cuándo va: una hora fija o relativo al día del cliente
  ancla text not null default 'en_el_dia' check (ancla in (
    'hora_fija', 'al_despertar', 'antes_entreno', 'durante_entreno', 'despues_entreno',
    'con_desayuno', 'con_almuerzo', 'con_merienda', 'con_cena', 'con_snack',
    'antes_dormir', 'en_el_dia'
  )),
  offset_min integer not null default 0 check (offset_min between -240 and 240),
  hora time,
  dias smallint[] not null default '{1,2,3,4,5,6,7}',
  aplica text not null default 'todos' check (aplica in ('todos', 'entreno', 'descanso')),
  -- Progresión: semanas desde el inicio del protocolo en que aplica
  semana_desde integer check (semana_desde >= 1),
  semana_hasta integer check (semana_hasta >= 1),
  orden integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists protocolo_items_protocolo_idx on protocolo_items (protocolo_id, orden);

alter table protocolos enable row level security;
drop policy if exists protocolos_select on protocolos;
create policy protocolos_select on protocolos
  for select to authenticated
  using ((user_id = auth.uid() and publicado) or public.is_entrenador());
drop policy if exists protocolos_write on protocolos;
create policy protocolos_write on protocolos
  for all to authenticated
  using (public.is_entrenador())
  with check (public.is_entrenador());

alter table protocolo_items enable row level security;
drop policy if exists protocolo_items_select on protocolo_items;
create policy protocolo_items_select on protocolo_items
  for select to authenticated
  using (
    public.is_entrenador()
    or exists (
      select 1 from protocolos p
      where p.id = protocolo_items.protocolo_id and p.user_id = auth.uid() and p.publicado
    )
  );
drop policy if exists protocolo_items_write on protocolo_items;
create policy protocolo_items_write on protocolo_items
  for all to authenticated
  using (public.is_entrenador())
  with check (public.is_entrenador());

-- Horas de comida que fija el entrenador en su texto ({"almuerzo":"13:00"});
-- tienen prioridad sobre las del cuestionario del cliente.
alter table meal_plans add column if not exists horarios jsonb;
