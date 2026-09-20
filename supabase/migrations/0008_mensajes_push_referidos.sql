-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Mensajes, notificaciones push y referidos
-- Correr DESPUÉS de 0007_pago_vence.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ── Mensajes entrenador ↔ cliente ───────────────────────────────
create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade, -- el cliente del hilo
  de text not null check (de in ('entrenador', 'cliente')),
  texto text not null,
  leido_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mensajes_user_idx on mensajes (user_id, created_at desc);

alter table mensajes enable row level security;
drop policy if exists mensajes_all on mensajes;
create policy mensajes_all on mensajes
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());

-- ── Suscripciones Web Push (PWA) ────────────────────────────────
-- Una fila por navegador/teléfono. El servidor manda con la clave VAPID
-- privada (variable de entorno); la pública viaja al cliente.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  ultimo_envio_at timestamptz
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
drop policy if exists push_subscriptions_all on push_subscriptions;
create policy push_subscriptions_all on push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() or public.is_entrenador())
  with check (user_id = auth.uid() or public.is_entrenador());

-- ── Referidos ───────────────────────────────────────────────────
-- Cada cliente tiene un código; quien se registra con él queda enlazado.
-- El descuento lo aplica el entrenador a mano (ve ambos en su panel).
alter table profiles add column if not exists codigo_referido text;
alter table profiles add column if not exists referido_por uuid references auth.users (id) on delete set null;
create unique index if not exists profiles_codigo_referido_uidx on profiles (codigo_referido) where codigo_referido is not null;

-- Código legible generado al crear el perfil: 4 letras del nombre + 4 al azar
create or replace function public.generar_codigo_referido(nombre text)
returns text
language plpgsql
set search_path = public
as $$
declare
  base text := upper(regexp_replace(coalesce(nombre, ''), '[^a-zA-Z]', '', 'g'));
  codigo text;
begin
  if length(base) < 2 then base := 'AMIGO'; end if;
  loop
    codigo := substr(base, 1, 4) || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from profiles where codigo_referido = codigo);
  end loop;
  return codigo;
end;
$$;

-- El trigger de alta también asigna el código y enlaza al referente si
-- el registro trajo `referido` en los metadatos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  referente uuid;
begin
  select id into referente from public.profiles
   where codigo_referido = upper(trim(coalesce(new.raw_user_meta_data ->> 'referido', '')))
   limit 1;
  insert into public.profiles (id, email, nombre, rol, codigo_referido, referido_por)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    case
      when exists (select 1 from public.entrenadores where lower(email) = lower(new.email))
        then 'entrenador'
      else 'cliente'
    end,
    public.generar_codigo_referido(new.raw_user_meta_data ->> 'nombre'),
    referente
  );
  return new;
end;
$$;

-- Clientes que ya existían: les damos código
update profiles set codigo_referido = public.generar_codigo_referido(nombre)
 where codigo_referido is null and rol = 'cliente';

revoke execute on function public.generar_codigo_referido(text) from public, anon;
grant execute on function public.generar_codigo_referido(text) to authenticated, supabase_auth_admin;
