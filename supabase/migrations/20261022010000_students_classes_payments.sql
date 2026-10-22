-- Fase 1: fichas de alumnos, exoneración, grados, clases y asistencia, pagos y notificaciones.

-- ---------------------------------------------------------------------------
-- Ajustes de la academia
-- ---------------------------------------------------------------------------

alter table public.academies
  add column late_tolerance_minutes int not null default 10 check (late_tolerance_minutes between 0 and 120),
  -- Código que va en el QR / sticker NFC de la academia. Se puede rotar.
  add column checkin_code text not null default public.generate_join_code();

-- ---------------------------------------------------------------------------
-- Planes de pago (antes de students, que los referencia)
-- ---------------------------------------------------------------------------

create table public.fee_plans (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  amount int not null check (amount >= 0),
  billing_day int not null default 5 check (billing_day between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fee_plans_academy_idx on public.fee_plans (academy_id);

-- ---------------------------------------------------------------------------
-- Alumnos (fichas)
-- ---------------------------------------------------------------------------

create type public.student_status as enum ('pending', 'active', 'inactive');

create table public.students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- Cuenta del propio alumno (null si es un menor o si el profesor lo cargó sin cuenta).
  user_id uuid references public.profiles (id) on delete set null,
  -- Apoderado que administra la ficha (menores).
  guardian_user_id uuid references public.profiles (id) on delete set null,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  rut text,
  birth_date date not null,
  gender text check (gender in ('F', 'M', 'X')),
  phone text,
  email text,
  photo_path text,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_notes text,
  prior_experience text,
  joined_at date not null default current_date,
  status public.student_status not null default 'pending',
  left_at date,
  left_reason text,
  fee_plan_id uuid references public.fee_plans (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_academy_idx on public.students (academy_id);
create index students_guardian_idx on public.students (guardian_user_id);
create unique index students_user_unique on public.students (academy_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Exoneración de responsabilidad
-- ---------------------------------------------------------------------------

create table public.waiver_templates (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  version int not null default 1,
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (academy_id, version)
);

create table public.waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  template_id uuid not null references public.waiver_templates (id) on delete restrict,
  signer_name text not null check (length(trim(signer_name)) > 0),
  signer_rut text,
  signer_relationship text not null check (signer_relationship in ('self', 'guardian')),
  -- Trazo de la firma como datos de un <path> SVG (se dibuja igual en la app y en el PDF).
  signature_svg text not null,
  signed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  signed_at timestamptz not null default now()
);

create index waiver_signatures_student_idx on public.waiver_signatures (student_id);

-- ---------------------------------------------------------------------------
-- Grados (historial de cinturones)
-- ---------------------------------------------------------------------------

create table public.rank_awards (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  belt_id uuid not null references public.belts (id) on delete restrict,
  degree int not null default 0 check (degree between 0 and 10),
  awarded_at date not null default current_date,
  awarded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  notes text,
  created_at timestamptz not null default now()
);

create index rank_awards_student_idx on public.rank_awards (student_id, awarded_at desc);

-- ---------------------------------------------------------------------------
-- Clases y asistencia
-- ---------------------------------------------------------------------------

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- 0 = domingo … 6 = sábado (igual que extract(dow)).
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  title text not null,
  category_id uuid references public.categories (id) on delete set null,
  instructor_id uuid references public.profiles (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index class_schedules_academy_idx on public.class_schedules (academy_id, weekday);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  schedule_id uuid references public.class_schedules (id) on delete set null,
  date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  unique (schedule_id, date)
);

create index class_sessions_academy_idx on public.class_sessions (academy_id, date);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method text not null default 'manual' check (method in ('manual', 'qr', 'nfc')),
  is_late boolean not null default false,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  unique (session_id, student_id)
);

create index attendance_student_idx on public.attendance (student_id);

-- ---------------------------------------------------------------------------
-- Cobros y pagos
-- ---------------------------------------------------------------------------

create type public.charge_status as enum ('pending', 'paid', 'void');

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  concept text not null check (concept in ('enrollment', 'monthly', 'event', 'product', 'course', 'other')),
  -- Mes que cubre una mensualidad, formato AAAA-MM.
  period text check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  description text,
  amount int not null check (amount >= 0),
  discount int not null default 0 check (discount >= 0),
  due_date date not null default current_date,
  status public.charge_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount <= amount)
);

create index charges_student_idx on public.charges (student_id, due_date);
create index charges_academy_status_idx on public.charges (academy_id, status, due_date);
create unique index charges_monthly_unique on public.charges (student_id, period) where concept = 'monthly';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  charge_id uuid not null references public.charges (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  amount int not null check (amount > 0),
  paid_at timestamptz not null default now(),
  method text not null default 'cash' check (method in ('cash', 'transfer', 'card', 'gateway', 'other')),
  reference text,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index payments_charge_idx on public.payments (charge_id);

-- Descuentos pendientes (ej. por referido): se aplican a la próxima mensualidad generada.
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  percent int not null check (percent between 1 and 100),
  reason text not null,
  used_charge_id uuid references public.charges (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  referrer_student_id uuid not null references public.students (id) on delete cascade,
  referred_student_id uuid not null unique references public.students (id) on delete cascade,
  discount_id uuid references public.discounts (id) on delete set null,
  created_at timestamptz not null default now(),
  check (referrer_student_id <> referred_student_id)
);

-- ---------------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unsent_idx on public.notifications (created_at) where push_sent_at is null;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger fee_plans_updated_at before update on public.fee_plans
  for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger class_schedules_updated_at before update on public.class_schedules
  for each row execute function public.set_updated_at();
create trigger charges_updated_at before update on public.charges
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Autorización
-- ---------------------------------------------------------------------------

create function public.is_staff(p_academy uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_academy, array['owner', 'instructor']::public.member_role[]);
$$;

-- ¿Puede el usuario actual ver/gestionar esta ficha? Staff de su academia, el propio alumno o su apoderado.
create function public.can_access_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student
      and (
        s.user_id = auth.uid()
        or s.guardian_user_id = auth.uid()
        or public.is_staff(s.academy_id)
      )
  );
$$;

-- ¿p_user es staff activo de alguna academia donde el usuario actual es miembro activo?
-- (para que los alumnos vean el nombre de sus profesores).
create function public.is_staff_colleague(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships staff
    join public.memberships me on me.academy_id = staff.academy_id
    where staff.user_id = p_user
      and staff.status = 'active'
      and staff.role in ('owner', 'instructor')
      and me.user_id = auth.uid()
      and me.status = 'active'
  );
$$;

create policy "profiles_select_staff_colleagues" on public.profiles
  for select to authenticated
  using (public.is_staff_colleague(id));

-- ---------------------------------------------------------------------------
-- Integridad: academy_id se toma del alumno y los catálogos deben ser de la misma academia
-- ---------------------------------------------------------------------------

create function public.set_academy_from_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select academy_id into new.academy_id from public.students where id = new.student_id;
  if new.academy_id is null then
    raise exception 'Alumno no encontrado' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger waiver_signatures_academy before insert on public.waiver_signatures
  for each row execute function public.set_academy_from_student();
create trigger rank_awards_academy before insert or update of student_id on public.rank_awards
  for each row execute function public.set_academy_from_student();
create trigger attendance_academy before insert on public.attendance
  for each row execute function public.set_academy_from_student();
create trigger charges_academy before insert on public.charges
  for each row execute function public.set_academy_from_student();
create trigger discounts_academy before insert on public.discounts
  for each row execute function public.set_academy_from_student();

create function public.check_same_academy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid;
begin
  if tg_table_name = 'rank_awards' then
    select academy_id into v_other from public.belts where id = new.belt_id;
  elsif tg_table_name = 'waiver_signatures' then
    select academy_id into v_other from public.waiver_templates where id = new.template_id;
  elsif tg_table_name = 'attendance' then
    select academy_id into v_other from public.class_sessions where id = new.session_id;
  elsif tg_table_name = 'students' then
    if new.fee_plan_id is null then
      return new;
    end if;
    select academy_id into v_other from public.fee_plans where id = new.fee_plan_id;
  elsif tg_table_name = 'class_schedules' then
    if new.category_id is null then
      return new;
    end if;
    select academy_id into v_other from public.categories where id = new.category_id;
  end if;

  if v_other is distinct from new.academy_id then
    raise exception 'Los datos pertenecen a otra academia' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger rank_awards_same_academy before insert or update on public.rank_awards
  for each row execute function public.check_same_academy();
create trigger waiver_signatures_same_academy before insert on public.waiver_signatures
  for each row execute function public.check_same_academy();
create trigger attendance_same_academy before insert on public.attendance
  for each row execute function public.check_same_academy();
create trigger students_same_academy before insert or update of fee_plan_id on public.students
  for each row execute function public.check_same_academy();
create trigger class_schedules_same_academy before insert or update of category_id on public.class_schedules
  for each row execute function public.check_same_academy();

-- payments: academia y alumno se toman del cobro.
create function public.set_payment_from_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select academy_id, student_id into new.academy_id, new.student_id
  from public.charges where id = new.charge_id;
  if new.academy_id is null then
    raise exception 'Cobro no encontrado' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger payments_from_charge before insert on public.payments
  for each row execute function public.set_payment_from_charge();

-- El estado del cobro se recalcula con cada pago.
create function public.refresh_charge_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge uuid := coalesce(new.charge_id, old.charge_id);
begin
  update public.charges c
  set status = case
      when c.status = 'void' then 'void'::public.charge_status
      when coalesce((select sum(p.amount) from public.payments p where p.charge_id = c.id), 0) >= c.amount - c.discount
        then 'paid'::public.charge_status
      else 'pending'::public.charge_status
    end
  where c.id = v_charge;
  return null;
end;
$$;

create trigger payments_refresh_charge after insert or delete on public.payments
  for each row execute function public.refresh_charge_status();

-- Alumnos y apoderados solo pueden cambiar sus datos de contacto, no el estado ni el plan.
create function public.protect_student_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_staff(old.academy_id) then
    return new;
  end if;
  if new.status is distinct from old.status
    or new.joined_at is distinct from old.joined_at
    or new.left_at is distinct from old.left_at
    or new.left_reason is distinct from old.left_reason
    or new.fee_plan_id is distinct from old.fee_plan_id
    or new.academy_id is distinct from old.academy_id
    or new.user_id is distinct from old.user_id
    or new.guardian_user_id is distinct from old.guardian_user_id then
    raise exception 'Solo el profesor puede cambiar estos datos' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger students_protect_fields before update on public.students
  for each row execute function public.protect_student_fields();

-- ---------------------------------------------------------------------------
-- Vistas (security_invoker: respetan el RLS de quien consulta)
-- ---------------------------------------------------------------------------

create view public.student_progress
with (security_invoker = true)
as
select
  s.id as student_id,
  s.academy_id,
  r.belt_id,
  r.degree,
  r.awarded_at,
  (select count(*) from public.attendance a where a.student_id = s.id)::int as total_classes,
  (
    select count(*)
    from public.attendance a
    join public.class_sessions cs on cs.id = a.session_id
    where a.student_id = s.id
      and cs.date >= coalesce(r.awarded_at, s.joined_at)
  )::int as classes_since_award,
  (
    select max(cs.date)
    from public.attendance a
    join public.class_sessions cs on cs.id = a.session_id
    where a.student_id = s.id
  ) as last_class_date
from public.students s
left join lateral (
  -- El grado vigente es el más reciente; si hay dos el mismo día, el más alto.
  select ra.belt_id, ra.degree, ra.awarded_at
  from public.rank_awards ra
  join public.belts b on b.id = ra.belt_id
  where ra.student_id = s.id
  order by ra.awarded_at desc, b.sort_order desc, ra.degree desc, ra.created_at desc
  limit 1
) r on true;

create view public.charge_balances
with (security_invoker = true)
as
select
  c.*,
  coalesce(p.paid, 0)::int as paid_amount,
  greatest(c.amount - c.discount - coalesce(p.paid, 0), 0)::int as remaining
from public.charges c
left join lateral (
  select sum(amount) as paid from public.payments where charge_id = c.id
) p on true;

create view public.student_balances
with (security_invoker = true)
as
select
  s.id as student_id,
  s.academy_id,
  coalesce(sum(cb.remaining) filter (where cb.status = 'pending'), 0)::int as pending_amount,
  count(*) filter (where cb.status = 'pending')::int as pending_count,
  count(*) filter (where cb.status = 'pending' and cb.concept = 'monthly' and cb.due_date < current_date)::int
    as overdue_months,
  min(cb.due_date) filter (where cb.status = 'pending') as oldest_due_date
from public.students s
left join public.charge_balances cb on cb.student_id = s.id
group by s.id, s.academy_id;

-- ---------------------------------------------------------------------------
-- Notificaciones: funciones internas
-- ---------------------------------------------------------------------------

create function public.notify_user(
  p_user uuid, p_academy uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, academy_id, type, title, body, data)
  select p_user, p_academy, p_type, p_title, p_body, p_data
  where p_user is not null;
$$;

create function public.notify_staff(
  p_academy uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, academy_id, type, title, body, data)
  select distinct m.user_id, p_academy, p_type, p_title, p_body, p_data
  from public.memberships m
  where m.academy_id = p_academy
    and m.status = 'active'
    and m.role in ('owner', 'instructor');
$$;

-- Notifica al alumno y a su apoderado (si tienen cuenta).
create function public.notify_student(
  p_student uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, academy_id, type, title, body, data)
  select distinct u.user_id, s.academy_id, p_type, p_title, p_body, p_data || jsonb_build_object('student_id', s.id)
  from public.students s
  cross join lateral (values (s.user_id), (s.guardian_user_id)) as u (user_id)
  where s.id = p_student
    and u.user_id is not null;
$$;

create function public.on_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy_name text;
  v_user_name text;
begin
  select name into v_academy_name from public.academies where id = new.academy_id;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    select full_name into v_user_name from public.profiles where id = new.user_id;
    perform public.notify_staff(
      new.academy_id, 'membership_request', 'Nueva solicitud de ingreso',
      coalesce(nullif(v_user_name, ''), 'Alguien') || ' quiere unirse a ' || v_academy_name,
      jsonb_build_object('membership_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.notify_user(
      new.user_id, new.academy_id, 'membership_approved', '¡Bienvenido!',
      'Tu solicitud en ' || v_academy_name || ' fue aprobada.', '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

create trigger memberships_notify after insert or update of status on public.memberships
  for each row execute function public.on_membership_change();

create function public.on_rank_award()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_belt text;
begin
  -- El primer cinturón (asignado al activar la ficha) no se celebra.
  if not exists (
    select 1 from public.rank_awards where student_id = new.student_id and id <> new.id
  ) then
    return new;
  end if;
  select name into v_belt from public.belts where id = new.belt_id;
  perform public.notify_student(
    new.student_id, 'rank_award', '¡Felicitaciones!',
    'Nuevo grado: cinturón ' || lower(v_belt) || case when new.degree > 0 then ', ' || new.degree || '° grado' else '' end || '.'
  );
  return new;
end;
$$;

create trigger rank_awards_notify after insert on public.rank_awards
  for each row execute function public.on_rank_award();

-- Al activar una ficha sin grados, se le asigna el cinturón blanco (kids si tiene menos de 16).
create function public.assign_initial_belt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_belt uuid;
begin
  if new.status <> 'active' or exists (select 1 from public.rank_awards where student_id = new.id) then
    return new;
  end if;

  select id into v_belt
  from public.belts
  where academy_id = new.academy_id
    and track = case
      when extract(year from age(new.joined_at, new.birth_date)) < 16 then 'kids'::public.belt_track
      else 'adult'::public.belt_track
    end
  order by sort_order
  limit 1;

  if v_belt is not null then
    insert into public.rank_awards (academy_id, student_id, belt_id, degree, awarded_at, awarded_by, notes)
    values (new.academy_id, new.id, v_belt, 0, new.joined_at, null, 'Cinturón inicial');
  end if;
  return new;
end;
$$;

create trigger students_initial_belt after insert or update of status on public.students
  for each row execute function public.assign_initial_belt();

-- ---------------------------------------------------------------------------
-- Plantilla por defecto: se agrega exoneración y un plan mensual
-- ---------------------------------------------------------------------------

create function public.seed_academy_billing_and_waiver(p_academy uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select name into v_name from public.academies where id = p_academy;

  insert into public.waiver_templates (academy_id, version, title, body) values (
    p_academy, 1, 'Exoneración de responsabilidad',
    'Declaro que participo de forma voluntaria en las clases de Jiu-Jitsu de ' || v_name || '. '
    || 'Entiendo que es una actividad física de contacto que implica riesgo de lesiones. '
    || 'Declaro estar en condiciones de salud aptas para entrenar y me comprometo a informar al profesor '
    || 'cualquier lesión, enfermedad o condición médica relevante. '
    || 'Libero a la academia y a sus instructores de responsabilidad por lesiones que ocurran durante la '
    || 'práctica normal de la disciplina, salvo negligencia grave. '
    || 'Me comprometo a respetar el reglamento de la academia. '
    || 'Si firmo como apoderado, lo hago en representación del menor indicado en la ficha.'
  );

  insert into public.fee_plans (academy_id, name, amount, billing_day)
  values (p_academy, 'Mensualidad', 0, 5);
end;
$$;

-- create_academy ahora también crea la exoneración y el plan base.
create or replace function public.create_academy(p_name text)
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
  perform public.seed_academy_billing_and_waiver(v_academy.id);

  return v_academy;
end;
$$;

-- Al aprobar una membresía también se activan las fichas pendientes de esa persona (o de sus hijos).
create or replace function public.review_membership(p_membership uuid, p_approve boolean)
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

  if p_approve then
    update public.students
    set status = 'active'
    where academy_id = v_membership.academy_id
      and status = 'pending'
      and (
        (v_membership.role = 'student' and user_id = v_membership.user_id)
        or (v_membership.role = 'guardian' and guardian_user_id = v_membership.user_id)
      );
  end if;

  return v_membership;
end;
$$;

-- ---------------------------------------------------------------------------
-- Acciones (RPC)
-- ---------------------------------------------------------------------------

-- Vincula la cuenta de un usuario a una ficha que el profesor ya había cargado.
-- Si el usuario había creado su propia ficha pendiente, esa se elimina.
create function public.link_student_account(p_student uuid, p_user uuid)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students;
begin
  select * into v_student from public.students where id = p_student;
  if v_student.id is null or not public.is_staff(v_student.academy_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if v_student.user_id is not null then
    raise exception 'La ficha ya tiene una cuenta vinculada' using errcode = '22023';
  end if;

  delete from public.students
  where academy_id = v_student.academy_id and user_id = p_user and id <> p_student and status = 'pending';

  update public.students set user_id = p_user where id = p_student returning * into v_student;
  return v_student;
end;
$$;

create function public.rotate_checkin_code(p_academy uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_staff(p_academy) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update public.academies set checkin_code = public.generate_join_code()
  where id = p_academy
  returning checkin_code into v_code;
  return v_code;
end;
$$;

-- Crea (si no existe) la sesión de una clase del horario en una fecha.
create function public.ensure_class_session(p_schedule uuid, p_date date)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.class_schedules;
  v_tz text;
  v_session public.class_sessions;
begin
  select * into v_schedule from public.class_schedules where id = p_schedule;
  if v_schedule.id is null or not public.is_staff(v_schedule.academy_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  select timezone into v_tz from public.academies where id = v_schedule.academy_id;

  insert into public.class_sessions (academy_id, schedule_id, date, starts_at, ends_at, title)
  values (
    v_schedule.academy_id, v_schedule.id, p_date,
    (p_date + v_schedule.start_time) at time zone v_tz,
    (p_date + v_schedule.end_time) at time zone v_tz,
    v_schedule.title
  )
  on conflict (schedule_id, date) do update set title = excluded.title
  returning * into v_session;

  return v_session;
end;
$$;

-- Marca asistencia con el código del QR / NFC. p_now permite probar con una hora fija.
create function public.check_in_at(
  p_academy uuid, p_code text, p_student uuid, p_method text, p_now timestamptz
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy public.academies;
  v_student public.students;
  v_local timestamp;
  v_schedule public.class_schedules;
  v_session public.class_sessions;
  v_attendance public.attendance;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select * into v_academy from public.academies where id = p_academy;
  if v_academy.id is null or v_academy.checkin_code <> upper(trim(p_code)) then
    raise exception 'Código de asistencia inválido' using errcode = 'P0002';
  end if;

  if p_student is null then
    select * into v_student from public.students
    where academy_id = p_academy and user_id = auth.uid();
  else
    select * into v_student from public.students
    where id = p_student and academy_id = p_academy
      and (user_id = auth.uid() or guardian_user_id = auth.uid() or public.is_staff(p_academy));
  end if;

  if v_student.id is null then
    raise exception 'No tienes una ficha en esta academia' using errcode = 'P0002';
  end if;
  if v_student.status <> 'active' then
    raise exception 'Tu ficha aún no está activa' using errcode = '42501';
  end if;

  v_local := p_now at time zone v_academy.timezone;

  -- Clase de hoy que empieza dentro de 30 minutos o que está en curso; la más cercana al inicio.
  select * into v_schedule
  from public.class_schedules cs
  where cs.academy_id = p_academy
    and cs.active
    and cs.weekday = extract(dow from v_local)::int
    -- Con fecha completa para que "30 minutos antes" no se dé vuelta a medianoche.
    and v_local between (v_local::date + cs.start_time) - interval '30 minutes'
                    and (v_local::date + cs.end_time)
  order by abs(extract(epoch from (v_local - (v_local::date + cs.start_time))))
  limit 1;

  if v_schedule.id is null then
    raise exception 'No hay una clase en este momento' using errcode = 'P0002';
  end if;

  insert into public.class_sessions (academy_id, schedule_id, date, starts_at, ends_at, title)
  values (
    p_academy, v_schedule.id, v_local::date,
    (v_local::date + v_schedule.start_time) at time zone v_academy.timezone,
    (v_local::date + v_schedule.end_time) at time zone v_academy.timezone,
    v_schedule.title
  )
  on conflict (schedule_id, date) do update set title = public.class_sessions.title
  returning * into v_session;

  if v_session.status = 'cancelled' then
    raise exception 'La clase de hoy fue cancelada' using errcode = '22023';
  end if;

  insert into public.attendance (academy_id, session_id, student_id, checked_in_at, method, is_late, recorded_by)
  values (
    p_academy, v_session.id, v_student.id, p_now,
    case when p_method in ('qr', 'nfc') then p_method else 'qr' end,
    v_local::time > v_schedule.start_time + make_interval(mins => v_academy.late_tolerance_minutes),
    auth.uid()
  )
  on conflict (session_id, student_id) do nothing
  returning * into v_attendance;

  if v_attendance.id is null then
    raise exception 'Ya marcaste asistencia en esta clase' using errcode = '23505';
  end if;

  return v_attendance;
end;
$$;

create function public.check_in(p_academy uuid, p_code text, p_student uuid default null, p_method text default 'qr')
returns public.attendance
language sql
security definer
set search_path = ''
as $$
  select public.check_in_at(p_academy, p_code, p_student, p_method, now());
$$;

-- Genera las mensualidades de un mes para los alumnos activos con plan. Aplica descuentos pendientes.
create function public.generate_monthly_charges(p_academy uuid, p_period text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_period text;
  v_first date;
  v_student record;
  v_discount public.discounts;
  v_charge_id uuid;
  v_count int := 0;
begin
  -- Sin sesión (tarea programada) se permite; con sesión, solo el staff.
  if auth.uid() is not null and not public.is_staff(p_academy) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  select timezone into v_tz from public.academies where id = p_academy;
  v_period := coalesce(p_period, to_char(now() at time zone v_tz, 'YYYY-MM'));
  v_first := to_date(v_period || '-01', 'YYYY-MM-DD');

  for v_student in
    select s.id, fp.amount, fp.billing_day, fp.name
    from public.students s
    join public.fee_plans fp on fp.id = s.fee_plan_id and fp.active
    where s.academy_id = p_academy
      and s.status = 'active'
      and fp.amount > 0
  loop
    select * into v_discount from public.discounts
    where student_id = v_student.id and used_charge_id is null
    order by created_at
    limit 1;

    insert into public.charges (academy_id, student_id, concept, period, description, amount, discount, due_date)
    values (
      p_academy, v_student.id, 'monthly', v_period,
      v_student.name || ' ' || to_char(v_first, 'MM/YYYY'),
      v_student.amount,
      coalesce(round(v_student.amount * v_discount.percent / 100.0)::int, 0),
      v_first + (v_student.billing_day - 1)
    )
    on conflict (student_id, period) where concept = 'monthly' do nothing
    returning id into v_charge_id;

    if v_charge_id is not null then
      v_count := v_count + 1;
      if v_discount.id is not null then
        update public.discounts set used_charge_id = v_charge_id where id = v_discount.id;
      end if;
      perform public.notify_student(
        v_student.id, 'charge_created', 'Nueva mensualidad',
        'Se generó la mensualidad de ' || to_char(v_first, 'MM/YYYY') || '.',
        jsonb_build_object('charge_id', v_charge_id)
      );
    end if;
    v_charge_id := null;
  end loop;

  return v_count;
end;
$$;

-- Registra que un alumno trajo a otro: el que trajo recibe un descuento en su próxima mensualidad.
create function public.register_referral(p_referrer uuid, p_referred uuid, p_percent int default 50)
returns public.referrals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy uuid;
  v_discount_id uuid;
  v_referral public.referrals;
  v_name text;
begin
  select academy_id into v_academy from public.students where id = p_referrer;
  if v_academy is null or not public.is_staff(v_academy) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students where id = p_referred and academy_id = v_academy) then
    raise exception 'Alumno no encontrado' using errcode = 'P0002';
  end if;

  select first_name || ' ' || last_name into v_name from public.students where id = p_referred;

  insert into public.discounts (academy_id, student_id, percent, reason)
  values (v_academy, p_referrer, p_percent, 'Referido: ' || v_name)
  returning id into v_discount_id;

  insert into public.referrals (academy_id, referrer_student_id, referred_student_id, discount_id)
  values (v_academy, p_referrer, p_referred, v_discount_id)
  returning * into v_referral;

  perform public.notify_student(
    p_referrer, 'referral', '¡Gracias por traer a un amigo!',
    'Tendrás ' || p_percent || '% de descuento en tu próxima mensualidad.'
  );

  return v_referral;
end;
$$;

-- Recordatorios de pago: 3 días antes del vencimiento, el día que vence y cada 7 días de atraso.
create function public.queue_payment_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge record;
  v_count int := 0;
begin
  for v_charge in
    select cb.id, cb.student_id, cb.remaining, cb.due_date, cb.description,
           (current_date - cb.due_date) as days_late
    from public.charge_balances cb
    where cb.status = 'pending'
      and cb.remaining > 0
      and (
        cb.due_date = current_date + 3
        or (current_date >= cb.due_date and (current_date - cb.due_date) % 7 = 0)
      )
  loop
    perform public.notify_student(
      v_charge.student_id, 'payment_reminder',
      case when v_charge.days_late < 0 then 'Tu pago vence pronto'
           when v_charge.days_late = 0 then 'Tu pago vence hoy'
           else 'Tienes un pago atrasado' end,
      coalesce(v_charge.description, 'Cobro') || ': $' || to_char(v_charge.remaining, 'FM999G999G999')
        || ' (vence el ' || to_char(v_charge.due_date, 'DD/MM') || ').',
      jsonb_build_object('charge_id', v_charge.id)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.fee_plans enable row level security;
alter table public.students enable row level security;
alter table public.waiver_templates enable row level security;
alter table public.waiver_signatures enable row level security;
alter table public.rank_awards enable row level security;
alter table public.class_schedules enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.discounts enable row level security;
alter table public.referrals enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

-- Planes: los ven los miembros; los edita el dueño.
create policy "fee_plans_select" on public.fee_plans for select to authenticated
  using (public.is_member(academy_id));
create policy "fee_plans_write" on public.fee_plans for all to authenticated
  using (public.has_role(academy_id, array['owner']::public.member_role[]))
  with check (public.has_role(academy_id, array['owner']::public.member_role[]));

-- Fichas
create policy "students_select" on public.students for select to authenticated
  using (user_id = auth.uid() or guardian_user_id = auth.uid() or public.is_staff(academy_id));

create policy "students_insert_staff" on public.students for insert to authenticated
  with check (public.is_staff(academy_id));

-- Un alumno crea su propia ficha (pendiente) si tiene una membresía de alumno en la academia.
create policy "students_insert_self" on public.students for insert to authenticated
  with check (
    user_id = auth.uid()
    and guardian_user_id is null
    and status = 'pending'
    and fee_plan_id is null
    and exists (
      select 1 from public.memberships m
      where m.academy_id = students.academy_id and m.user_id = auth.uid()
        and m.role = 'student' and m.status in ('pending', 'active')
    )
  );

-- Un apoderado crea fichas (pendientes) de sus hijos.
create policy "students_insert_guardian" on public.students for insert to authenticated
  with check (
    guardian_user_id = auth.uid()
    and user_id is null
    and status = 'pending'
    and fee_plan_id is null
    and exists (
      select 1 from public.memberships m
      where m.academy_id = students.academy_id and m.user_id = auth.uid()
        and m.role = 'guardian' and m.status in ('pending', 'active')
    )
  );

create policy "students_update" on public.students for update to authenticated
  using (user_id = auth.uid() or guardian_user_id = auth.uid() or public.is_staff(academy_id))
  with check (user_id = auth.uid() or guardian_user_id = auth.uid() or public.is_staff(academy_id));

create policy "students_delete" on public.students for delete to authenticated
  using (public.has_role(academy_id, array['owner']::public.member_role[]));

-- Exoneración
create policy "waiver_templates_select" on public.waiver_templates for select to authenticated
  using (public.has_any_membership(academy_id));
create policy "waiver_templates_write" on public.waiver_templates for all to authenticated
  using (public.has_role(academy_id, array['owner']::public.member_role[]))
  with check (public.has_role(academy_id, array['owner']::public.member_role[]));

create policy "waiver_signatures_select" on public.waiver_signatures for select to authenticated
  using (public.can_access_student(student_id));
create policy "waiver_signatures_insert" on public.waiver_signatures for insert to authenticated
  with check (public.can_access_student(student_id) and signed_by = auth.uid());

-- Grados
create policy "rank_awards_select" on public.rank_awards for select to authenticated
  using (public.can_access_student(student_id));
create policy "rank_awards_write" on public.rank_awards for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

-- Horario y sesiones: los ven los miembros; los edita el staff.
create policy "class_schedules_select" on public.class_schedules for select to authenticated
  using (public.is_member(academy_id));
create policy "class_schedules_write" on public.class_schedules for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "class_sessions_select" on public.class_sessions for select to authenticated
  using (public.is_member(academy_id));
create policy "class_sessions_write" on public.class_sessions for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

-- Asistencia: el staff la gestiona; el alumno ve la suya (marca con check_in).
create policy "attendance_select" on public.attendance for select to authenticated
  using (public.can_access_student(student_id));
create policy "attendance_write" on public.attendance for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

-- Cobros, pagos y descuentos: el staff los gestiona; el alumno ve los suyos.
create policy "charges_select" on public.charges for select to authenticated
  using (public.can_access_student(student_id));
create policy "charges_write" on public.charges for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "payments_select" on public.payments for select to authenticated
  using (public.can_access_student(student_id));
create policy "payments_write" on public.payments for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "discounts_select" on public.discounts for select to authenticated
  using (public.can_access_student(student_id));
create policy "discounts_write" on public.discounts for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "referrals_select" on public.referrals for select to authenticated
  using (public.is_staff(academy_id));

-- Notificaciones y tokens: cada uno los suyos.
create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notifications_delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy "push_tokens_own" on public.push_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke execute on function public.notify_user(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_staff(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_student(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.seed_academy_billing_and_waiver(uuid) from public, anon, authenticated;
revoke execute on function public.check_in_at(uuid, text, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.queue_payment_reminders() from public, anon, authenticated;
revoke execute on function public.on_membership_change() from public, anon, authenticated;
revoke execute on function public.on_rank_award() from public, anon, authenticated;
revoke execute on function public.assign_initial_belt() from public, anon, authenticated;

revoke execute on function public.link_student_account(uuid, uuid) from public, anon;
revoke execute on function public.rotate_checkin_code(uuid) from public, anon;
revoke execute on function public.ensure_class_session(uuid, date) from public, anon;
revoke execute on function public.check_in(uuid, text, uuid, text) from public, anon;
revoke execute on function public.generate_monthly_charges(uuid, text) from public, anon;
revoke execute on function public.register_referral(uuid, uuid, int) from public, anon;
revoke execute on function public.mark_notifications_read() from public, anon;

grant execute on function public.link_student_account(uuid, uuid) to authenticated;
grant execute on function public.rotate_checkin_code(uuid) to authenticated;
grant execute on function public.ensure_class_session(uuid, date) to authenticated;
grant execute on function public.check_in(uuid, text, uuid, text) to authenticated;
grant execute on function public.generate_monthly_charges(uuid, text) to authenticated;
grant execute on function public.register_referral(uuid, uuid, int) to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
