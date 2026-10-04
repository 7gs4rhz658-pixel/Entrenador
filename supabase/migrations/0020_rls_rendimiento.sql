-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Rendimiento de RLS y tope diario de IA
-- Correr DESPUÉS de 0019_proteger_perfil.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Las políticas evaluaban auth.uid() e is_entrenador() fila por fila
-- (aviso "auth_rls_initplan" de Supabase). Con (select …) se calculan una
-- vez por consulta. Mismo permiso que antes: dueño o entrenador.
do $$
declare t text;
begin
  foreach t in array array[
    'mesocycles', 'training_days', 'exercises', 'planned_sets', 'logged_sets',
    'week_closures', 'meal_logs', 'meal_plans', 'meal_plan_items', 'asistente_logs',
    'checkins', 'mensajes', 'push_subscriptions', 'medidas', 'sesiones_entreno',
    'fotos_progreso', 'records', 'checklist_dia'
  ] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format(
      'create policy %I_all on %I for all to authenticated
         using (user_id = (select auth.uid()) or (select public.is_entrenador()))
         with check (user_id = (select auth.uid()) or (select public.is_entrenador()))',
      t, t
    );
  end loop;
end $$;

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_entrenador()));
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_entrenador()))
  with check (id = (select auth.uid()) or (select public.is_entrenador()));

-- Protocolo: el cliente lee lo enviado; solo el entrenador escribe. La
-- escritura va por acción (insert/update/delete) para no sumar una
-- segunda política de lectura.
drop policy if exists protocolos_select on protocolos;
drop policy if exists protocolos_write on protocolos;
drop policy if exists protocolos_insert on protocolos;
drop policy if exists protocolos_update on protocolos;
drop policy if exists protocolos_delete on protocolos;
create policy protocolos_select on protocolos for select to authenticated
  using ((user_id = (select auth.uid()) and publicado) or (select public.is_entrenador()));
create policy protocolos_insert on protocolos for insert to authenticated
  with check ((select public.is_entrenador()));
create policy protocolos_update on protocolos for update to authenticated
  using ((select public.is_entrenador())) with check ((select public.is_entrenador()));
create policy protocolos_delete on protocolos for delete to authenticated
  using ((select public.is_entrenador()));

drop policy if exists protocolo_items_select on protocolo_items;
drop policy if exists protocolo_items_write on protocolo_items;
drop policy if exists protocolo_items_insert on protocolo_items;
drop policy if exists protocolo_items_update on protocolo_items;
drop policy if exists protocolo_items_delete on protocolo_items;
create policy protocolo_items_select on protocolo_items for select to authenticated
  using (
    (select public.is_entrenador())
    or exists (
      select 1 from protocolos p
      where p.id = protocolo_items.protocolo_id and p.user_id = (select auth.uid()) and p.publicado
    )
  );
create policy protocolo_items_insert on protocolo_items for insert to authenticated
  with check ((select public.is_entrenador()));
create policy protocolo_items_update on protocolo_items for update to authenticated
  using ((select public.is_entrenador())) with check ((select public.is_entrenador()));
create policy protocolo_items_delete on protocolo_items for delete to authenticated
  using ((select public.is_entrenador()));

drop policy if exists fotos_propias on storage.objects;
create policy fotos_propias on storage.objects
  for all to authenticated
  using (bucket_id = 'fotos' and ((select auth.uid())::text = (storage.foldername(name))[1] or (select public.is_entrenador())))
  with check (bucket_id = 'fotos' and ((select auth.uid())::text = (storage.foldername(name))[1] or (select public.is_entrenador())));

-- Llaves foráneas sin índice (aviso "unindexed_foreign_keys"): borrar un
-- usuario o un ejercicio recorría la tabla entera.
create index if not exists ingredients_creado_por_idx on ingredients (creado_por);
create index if not exists logged_sets_exercise_idx on logged_sets (exercise_id);
create index if not exists meal_logs_ingredient_idx on meal_logs (ingredient_id);
create index if not exists meal_logs_plan_item_fk_idx on meal_logs (plan_item_id);
create index if not exists meal_plan_items_ingredient_idx on meal_plan_items (ingredient_id);
create index if not exists meal_plan_items_user_idx on meal_plan_items (user_id);
create index if not exists planned_sets_exercise_idx on planned_sets (exercise_id);
create index if not exists planned_sets_user_idx on planned_sets (user_id);
create index if not exists plantillas_rutina_creado_por_idx on plantillas_rutina (creado_por);
create index if not exists profiles_referido_por_idx on profiles (referido_por);
create index if not exists protocolo_items_user_idx on protocolo_items (user_id);
create index if not exists sesiones_entreno_dia_idx on sesiones_entreno (training_day_id);
create index if not exists week_closures_user_idx on week_closures (user_id);

-- Función del sistema que no tiene por qué ser invocable por la API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ── Tope diario de IA por cliente ───────────────────────────────
-- El asistente, las recetas y sustituir comparten el límite gratis de
-- Groq con las importaciones del entrenador: cada consulta deja una fila
-- y se cuentan las del día. El cliente puede leer e insertar las suyas,
-- pero no borrarlas (no puede reiniciar su contador).
create table if not exists ia_uso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('asistente', 'recetas', 'sustituir')),
  created_at timestamptz not null default now()
);

create index if not exists ia_uso_user_fecha_idx on ia_uso (user_id, fecha);

alter table ia_uso enable row level security;
drop policy if exists ia_uso_select on ia_uso;
create policy ia_uso_select on ia_uso for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_entrenador()));
drop policy if exists ia_uso_insert on ia_uso;
create policy ia_uso_insert on ia_uso for insert to authenticated
  with check (user_id = (select auth.uid()));
