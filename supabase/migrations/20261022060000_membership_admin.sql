-- El dueño puede quitar o devolver el acceso a un miembro (no a sí mismo ni a otro dueño).

create function public.set_membership_status(p_membership uuid, p_status public.membership_status)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.memberships;
begin
  select * into v_membership from public.memberships where id = p_membership;
  if v_membership.id is null
    or not public.has_role(v_membership.academy_id, array['owner']::public.member_role[]) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if v_membership.role = 'owner' then
    raise exception 'No se puede cambiar el acceso de un dueño' using errcode = '42501';
  end if;
  if p_status not in ('active', 'inactive') then
    raise exception 'Estado no permitido' using errcode = '22023';
  end if;

  update public.memberships
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_membership
  returning * into v_membership;

  return v_membership;
end;
$$;

revoke execute on function public.set_membership_status(uuid, public.membership_status) from public, anon;
grant execute on function public.set_membership_status(uuid, public.membership_status) to authenticated;

-- Registra el token push del teléfono para el usuario actual. Si el mismo teléfono lo usaba otra
-- cuenta antes, el token pasa a la cuenta actual (con RLS directo esa actualización fallaría).
create function public.register_push_token(p_token text, p_platform text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_tokens (token, user_id, platform, updated_at)
  select p_token, auth.uid(), p_platform, now()
  where auth.uid() is not null
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
