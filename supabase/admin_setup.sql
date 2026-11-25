-- Ticketspot: permisos del panel administrativo.
-- Ejecutar en Supabase > SQL Editor DESPUÉS de schema.sql.
-- IMPORTANTE: reemplaza el correo por el correo exacto de tu cuenta.

-- 1) Asigna el rol en app_metadata (el usuario no puede modificarlo desde el navegador).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('TU_CORREO_ADMIN@EJEMPLO.COM');

-- Comprueba que se actualizó una fila. Si dice UPDATE 0, revisa el correo.

-- 2) Función de autorización basada en el JWT emitido por Supabase Auth.
create or replace function public.is_ticketspot_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- 3) Solo administradores pueden crear, editar y eliminar eventos.
drop policy if exists "Administradores gestionan eventos" on public.events;
create policy "Administradores gestionan eventos"
on public.events
for all
to authenticated
using (public.is_ticketspot_admin())
with check (public.is_ticketspot_admin());

-- 4) Administradores pueden consultar todas las ventas.
-- La política existente permite que cada comprador vea únicamente sus compras;
-- las políticas SELECT de PostgreSQL se combinan con OR.
drop policy if exists "Administradores ven todas las compras" on public.orders;
create policy "Administradores ven todas las compras"
on public.orders
for select
to authenticated
using (public.is_ticketspot_admin());

grant execute on function public.is_ticketspot_admin() to authenticated;
grant insert, update, delete on public.events to authenticated;

-- Verificación: debe devolver true al ejecutar como sesión de administrador.
-- select public.is_ticketspot_admin();
