-- Archivos privados por academia (bucket "academy").
-- Rutas:
--   {academy_id}/students/{student_id}/...  fotos de la ficha: staff, el alumno o su apoderado
--   {academy_id}/shared/...                 documentos, logos, imágenes de noticias: miembros activos

insert into storage.buckets (id, name, public)
values ('academy', 'academy', false)
on conflict (id) do nothing;

create function public.storage_academy(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create function public.storage_can_read(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_academy uuid := public.storage_academy(p_name);
  v_section text := split_part(p_name, '/', 2);
begin
  if v_academy is null then
    return false;
  end if;
  if v_section = 'shared' then
    return public.is_member(v_academy);
  elsif v_section = 'students' then
    begin
      return public.can_access_student(split_part(p_name, '/', 3)::uuid);
    exception when invalid_text_representation then
      return false;
    end;
  end if;
  return false;
end;
$$;

create function public.storage_can_write(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_academy uuid := public.storage_academy(p_name);
  v_section text := split_part(p_name, '/', 2);
begin
  if v_academy is null then
    return false;
  end if;
  if public.is_staff(v_academy) then
    return v_section in ('shared', 'students');
  end if;
  if v_section = 'students' then
    begin
      return public.can_access_student(split_part(p_name, '/', 3)::uuid);
    exception when invalid_text_representation then
      return false;
    end;
  end if;
  return false;
end;
$$;

create policy "academy_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'academy' and public.storage_can_read(name));

create policy "academy_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'academy' and public.storage_can_write(name));

create policy "academy_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'academy' and public.storage_can_write(name))
  with check (bucket_id = 'academy' and public.storage_can_write(name));

create policy "academy_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'academy' and public.storage_can_write(name));
