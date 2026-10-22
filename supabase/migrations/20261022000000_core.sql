-- Núcleo multi-academia: academias, perfiles, membresías, categorías y cinturones.
-- Cada tabla de negocio lleva academy_id y se protege con RLS (ver docs/PLAN.md §5).

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'instructor', 'student', 'guardian');
create type public.membership_status as enum ('pending', 'active', 'rejected', 'inactive');
create type public.belt_track as enum ('adult', 'kids');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Código de invitación legible: sin 0/O ni 1/I/L para evitar confusiones al dictarlo.
create function public.generate_join_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  join_code text not null unique default public.generate_join_code(),
  logo_path text,
  primary_color text check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'America/Santiago',
  currency text not null default 'CLP',
  plan text not null default 'basic' check (plan in ('basic', 'premium')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- Apunta a profiles (que cae en cascada desde auth.users) para poder embeber el perfil.
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  status public.membership_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, user_id, role)
);

create index memberships_user_idx on public.memberships (user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null,
  min_age int not null check (min_age >= 0),
  max_age int check (max_age is null or max_age >= min_age),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_academy_idx on public.categories (academy_id);

create table public.belts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  track public.belt_track not null,
  name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  -- Franja central de los cinturones kids combinados (ej. gris con blanco).
  stripe_color_hex text check (stripe_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  max_degrees int not null default 4 check (max_degrees between 0 and 10),
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index belts_academy_idx on public.belts (academy_id);

create trigger academies_updated_at before update on public.academies
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger belts_updated_at before update on public.belts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Funciones de autorización (usadas por las políticas RLS)
-- ---------------------------------------------------------------------------

-- ¿El usuario actual tiene una membresía ACTIVA en la academia con alguno de estos roles?
create function public.has_role(p_academy uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.academy_id = p_academy
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

-- ¿El usuario actual es miembro activo de la academia (cualquier rol)?
create function public.is_member(p_academy uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_academy, enum_range(null::public.member_role));
$$;

-- ¿El usuario actual tiene alguna membresía (incluso pendiente) en la academia?
-- Permite que quien espera aprobación vea el nombre de la academia.
create function public.has_any_membership(p_academy uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.academy_id = p_academy
      and m.user_id = auth.uid()
      and m.status in ('pending', 'active')
  );
$$;

-- ¿El usuario actual es staff activo de alguna academia donde p_user tiene membresía?
create function public.is_staff_of_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships target
    join public.memberships staff on staff.academy_id = target.academy_id
    where target.user_id = p_user
      and staff.user_id = auth.uid()
      and staff.status = 'active'
      and staff.role in ('owner', 'instructor')
  );
$$;

-- ---------------------------------------------------------------------------
-- Datos por defecto de una academia nueva (plantilla Jiu-Jitsu)
-- ---------------------------------------------------------------------------

create function public.seed_academy_defaults(p_academy uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (academy_id, name, min_age, max_age, sort_order) values
    (p_academy, 'Infantil / Kids', 4, 8, 1),
    (p_academy, 'Juvenil 1', 9, 14, 2),
    (p_academy, 'Juvenil 2', 15, 17, 3),
    (p_academy, 'Adulto', 18, null, 4);

  insert into public.belts (academy_id, track, name, color_hex, stripe_color_hex, max_degrees, sort_order) values
    (p_academy, 'adult', 'Blanco',  '#F5F5F5', null, 4, 1),
    (p_academy, 'adult', 'Azul',    '#1F4E9C', null, 4, 2),
    (p_academy, 'adult', 'Morado',  '#5B2A86', null, 4, 3),
    (p_academy, 'adult', 'Café',    '#5C3A1E', null, 4, 4),
    (p_academy, 'adult', 'Negro',   '#111111', null, 6, 5),
    (p_academy, 'kids', 'Blanco',            '#F5F5F5', null,      4, 1),
    (p_academy, 'kids', 'Gris y blanco',     '#8E8E8E', '#F5F5F5', 4, 2),
    (p_academy, 'kids', 'Gris',              '#8E8E8E', null,      4, 3),
    (p_academy, 'kids', 'Gris y negro',      '#8E8E8E', '#111111', 4, 4),
    (p_academy, 'kids', 'Amarillo y blanco', '#F2C230', '#F5F5F5', 4, 5),
    (p_academy, 'kids', 'Amarillo',          '#F2C230', null,      4, 6),
    (p_academy, 'kids', 'Amarillo y negro',  '#F2C230', '#111111', 4, 7),
    (p_academy, 'kids', 'Naranja y blanco',  '#E8742A', '#F5F5F5', 4, 8),
    (p_academy, 'kids', 'Naranja',           '#E8742A', null,      4, 9),
    (p_academy, 'kids', 'Naranja y negro',   '#E8742A', '#111111', 4, 10),
    (p_academy, 'kids', 'Verde y blanco',    '#2E8B57', '#F5F5F5', 4, 11),
    (p_academy, 'kids', 'Verde',             '#2E8B57', null,      4, 12),
    (p_academy, 'kids', 'Verde y negro',     '#2E8B57', '#111111', 4, 13);
end;
$$;

-- ---------------------------------------------------------------------------
-- Acciones (RPC). Las escrituras sensibles pasan por aquí, no por INSERT directo.
-- ---------------------------------------------------------------------------

-- Crea una academia; quien la crea queda como dueño activo.
create function public.create_academy(p_name text)
returns public.academies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy public.academies;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  loop
    begin
      insert into public.academies (name, created_by)
      values (trim(p_name), auth.uid())
      returning * into v_academy;
      exit;
    exception when unique_violation then
      -- Choque de join_code (muy improbable): se reintenta con otro código.
      null;
    end;
  end loop;

  insert into public.memberships (academy_id, user_id, role, status, reviewed_by, reviewed_at)
  values (v_academy.id, auth.uid(), 'owner', 'active', auth.uid(), now());

  perform public.seed_academy_defaults(v_academy.id);

  return v_academy;
end;
$$;

-- Solicita unirse a una academia con su código. Queda pendiente hasta que el staff apruebe.
create function public.join_academy(p_code text, p_role public.member_role default 'student')
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy_id uuid;
  v_membership public.memberships;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'Rol no permitido' using errcode = '42501';
  end if;

  select id into v_academy_id
  from public.academies
  where join_code = upper(trim(p_code));

  if v_academy_id is null then
    raise exception 'Código de academia inválido' using errcode = 'P0002';
  end if;

  insert into public.memberships (academy_id, user_id, role)
  values (v_academy_id, auth.uid(), p_role)
  on conflict (academy_id, user_id, role) do update
    -- Una solicitud rechazada o una baja puede volver a postular; una activa no cambia.
    set status = case
        when public.memberships.status in ('rejected', 'inactive') then 'pending'::public.membership_status
        else public.memberships.status
      end
  returning * into v_membership;

  return v_membership;
end;
$$;

-- Aprueba o rechaza una solicitud. Staff aprueba alumnos/apoderados; solo el dueño aprueba instructores.
create function public.review_membership(p_membership uuid, p_approve boolean)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.memberships;
  v_allowed public.member_role[];
begin
  select * into v_membership from public.memberships where id = p_membership;

  if v_membership.id is null then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;

  v_allowed := case
    when v_membership.role in ('student', 'guardian') then array['owner', 'instructor']::public.member_role[]
    else array['owner']::public.member_role[]
  end;

  if not public.has_role(v_membership.academy_id, v_allowed) then
    raise exception 'Sin permiso para revisar esta solicitud' using errcode = '42501';
  end if;

  if v_membership.status <> 'pending' then
    raise exception 'La solicitud ya fue revisada' using errcode = '22023';
  end if;

  update public.memberships
  set status = case when p_approve then 'active'::public.membership_status else 'rejected'::public.membership_status end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_membership
  returning * into v_membership;

  return v_membership;
end;
$$;

-- Genera un código de invitación nuevo (ej. si el anterior se filtró).
create function public.regenerate_join_code(p_academy uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.has_role(p_academy, array['owner']::public.member_role[]) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  loop
    begin
      update public.academies
      set join_code = public.generate_join_code()
      where id = p_academy
      returning join_code into v_code;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.academies enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.categories enable row level security;
alter table public.belts enable row level security;

-- Academias: las ve quien tiene membresía (incluida pendiente); solo el dueño edita.
create policy "academies_select" on public.academies
  for select to authenticated
  using (public.has_any_membership(id));

create policy "academies_update" on public.academies
  for update to authenticated
  using (public.has_role(id, array['owner']::public.member_role[]))
  with check (public.has_role(id, array['owner']::public.member_role[]));

-- Perfiles: cada uno ve y edita el suyo; el staff ve los de sus miembros.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff_of_user(id));

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Membresías: cada uno ve las suyas; el staff ve las de su academia. Escritura solo vía RPC.
create policy "memberships_select" on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(academy_id, array['owner', 'instructor']::public.member_role[])
  );

-- Categorías y cinturones: los ven los miembros activos; los edita el dueño.
create policy "categories_select" on public.categories
  for select to authenticated
  using (public.is_member(academy_id));

create policy "categories_write" on public.categories
  for all to authenticated
  using (public.has_role(academy_id, array['owner']::public.member_role[]))
  with check (public.has_role(academy_id, array['owner']::public.member_role[]));

create policy "belts_select" on public.belts
  for select to authenticated
  using (public.is_member(academy_id));

create policy "belts_write" on public.belts
  for all to authenticated
  using (public.has_role(academy_id, array['owner']::public.member_role[]))
  with check (public.has_role(academy_id, array['owner']::public.member_role[]));

-- ---------------------------------------------------------------------------
-- Permisos: funciones internas fuera del alcance de los clientes
-- ---------------------------------------------------------------------------

revoke execute on function public.seed_academy_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_academy(text) from public, anon;
revoke execute on function public.join_academy(text, public.member_role) from public, anon;
revoke execute on function public.review_membership(uuid, boolean) from public, anon;
revoke execute on function public.regenerate_join_code(uuid) from public, anon;

grant execute on function public.create_academy(text) to authenticated;
grant execute on function public.join_academy(text, public.member_role) to authenticated;
grant execute on function public.review_membership(uuid, boolean) to authenticated;
grant execute on function public.regenerate_join_code(uuid) to authenticated;
