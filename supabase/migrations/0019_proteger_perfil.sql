-- ═══════════════════════════════════════════════════════════════
-- Mi Entrenador Personal · Cobro manual y perfil protegido
-- Correr DESPUÉS de 0018_rutina_fases.sql. Es idempotente.
-- ═══════════════════════════════════════════════════════════════

-- El cliente avisa "ya pagué" y el entrenador confirma el pago. La
-- contraseña temporal que da el entrenador obliga a cambiarla al entrar.
-- El aviso de privacidad se acepta una vez.
alter table profiles add column if not exists pago_avisado_at timestamptz;
alter table profiles add column if not exists debe_cambiar_clave boolean not null default false;
alter table profiles add column if not exists acepto_privacidad_at timestamptz;

-- Con la clave pública y su sesión, un cliente puede escribir en su
-- propio perfil (RLS lo deja). Este trigger le impide tocar lo que
-- decide el entrenador: rol, pago, vigencia, alta/baja, macros y
-- referidos. El entrenador, la clave de servicio (avisos, borrar cuenta)
-- y el SQL de administración no pasan por el chequeo.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and not public.is_entrenador() and (
    new.rol is distinct from old.rol
    or new.email is distinct from old.email
    or new.estado_pago is distinct from old.estado_pago
    or new.pagado_at is distinct from old.pagado_at
    or new.pago_vence_at is distinct from old.pago_vence_at
    or new.activo is distinct from old.activo
    or new.macros_manual is distinct from old.macros_manual
    or new.ajuste_macros_at is distinct from old.ajuste_macros_at
    or new.codigo_referido is distinct from old.codigo_referido
    or new.referido_por is distinct from old.referido_por
  ) then
    raise exception 'Solo tu entrenador puede cambiar tu pago, tu alta o tus macros.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_proteger_rol on profiles;
drop trigger if exists profiles_proteger_perfil on profiles;
create trigger profiles_proteger_perfil
  before update on profiles
  for each row execute procedure public.proteger_perfil();
drop function if exists public.proteger_rol();

-- Mensajes: lo que escribe un cliente siempre sale "de cliente" y, de los
-- mensajes existentes, solo puede marcar la lectura.
create or replace function public.proteger_mensaje()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and not public.is_entrenador() then
    if tg_op = 'INSERT' then
      new.de := 'cliente';
    else
      new.de := old.de;
      new.texto := old.texto;
      new.user_id := old.user_id;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mensajes_proteger on mensajes;
create trigger mensajes_proteger
  before insert or update on mensajes
  for each row execute procedure public.proteger_mensaje();
