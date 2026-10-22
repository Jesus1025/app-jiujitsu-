-- El código del QR de asistencia no debe ser visible para los alumnos: si lo leyeran,
-- podrían marcar asistencia desde la casa. Se oculta la columna y el staff lo obtiene por RPC.
-- OJO: al agregar columnas nuevas a academies hay que incluirlas en este grant.

revoke select on public.academies from anon, authenticated;

grant select (
  id, name, join_code, logo_path, primary_color, timezone, currency, plan, settings,
  created_by, created_at, updated_at, late_tolerance_minutes, public_slug
) on public.academies to authenticated;

create function public.get_checkin_code(p_academy uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_staff(p_academy) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select checkin_code into v_code from public.academies where id = p_academy;
  return v_code;
end;
$$;

revoke execute on function public.get_checkin_code(uuid) from public, anon;
grant execute on function public.get_checkin_code(uuid) to authenticated;
