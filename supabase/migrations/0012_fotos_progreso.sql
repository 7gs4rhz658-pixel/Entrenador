-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Fotos de progreso
-- Correr DESPUÉS de 0011_sesiones_entreno.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- Bucket privado: cada cliente sube a su carpeta (<user_id>/...), el
-- entrenador puede ver todo. Las fotos se sirven con URLs firmadas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists fotos_propias on storage.objects;
create policy fotos_propias on storage.objects
  for all to authenticated
  using (bucket_id = 'fotos' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_entrenador()))
  with check (bucket_id = 'fotos' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_entrenador()));

-- Índice de fotos: una por fecha y vista (frente, perfil, espalda)
create table if not exists fotos_progreso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  vista text not null check (vista in ('frente', 'perfil', 'espalda')),
  path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, fecha, vista)
);

create index if not exists fotos_progreso_user_idx on fotos_progreso (user_id, fecha desc);

alter table fotos_progreso enable row level security;
drop policy if exists fotos_progreso_all on fotos_progreso;
create policy fotos_progreso_all on fotos_progreso
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());
