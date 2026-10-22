-- Fase 2: graduación, calendario de eventos, noticias, documentos, ranking y panel del profesor.

-- ---------------------------------------------------------------------------
-- Notificar a toda la academia
-- ---------------------------------------------------------------------------

create function public.notify_academy(
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
    and m.user_id is distinct from auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Requisitos de graduación
-- ---------------------------------------------------------------------------

create table public.graduation_requirements (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- Grado al que se llega: cinturón + número de grado (0 = cinturón liso).
  belt_id uuid not null references public.belts (id) on delete cascade,
  degree int not null default 0 check (degree between 0 and 10),
  min_classes int not null default 0 check (min_classes >= 0),
  min_months int not null default 0 check (min_months >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (belt_id, degree)
);

create trigger graduation_requirements_updated_at before update on public.graduation_requirements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Eventos (graduaciones, seminarios, competencias)
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  type text not null default 'other'
    check (type in ('graduation', 'seminar', 'masterclass', 'competition', 'other')),
  title text not null check (length(trim(title)) > 0),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  price int not null default 0 check (price >= 0),
  -- Recordatorio semanal a los alumnos hasta la fecha del evento.
  weekly_reminder boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index events_academy_idx on public.events (academy_id, starts_at);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  charge_id uuid references public.charges (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Noticias y técnica de la semana
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  kind text not null default 'news' check (kind in ('news', 'technique')),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  video_url text,
  pinned boolean not null default false,
  -- Se muestra también en la página web de la academia (ver public_news).
  show_on_website boolean not null default false,
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index announcements_academy_idx on public.announcements (academy_id, published_at desc);

-- ---------------------------------------------------------------------------
-- Documentos (reglamento, manuales)
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  -- Ruta en el bucket "academy": {academy_id}/shared/documents/...
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes int,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index documents_academy_idx on public.documents (academy_id);

-- ---------------------------------------------------------------------------
-- Página web pública: noticias marcadas para la web
-- ---------------------------------------------------------------------------

alter table public.academies
  add column public_slug text unique check (public_slug ~ '^[a-z0-9-]{3,50}$');

create function public.public_news(p_slug text, p_limit int default 10)
returns table (title text, body text, kind text, published_at timestamptz, pinned boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select an.title, an.body, an.kind, an.published_at, an.pinned
  from public.announcements an
  join public.academies a on a.id = an.academy_id
  where a.public_slug = lower(p_slug)
    and an.show_on_website
    and an.published_at <= now()
  order by an.pinned desc, an.published_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Integridad
-- ---------------------------------------------------------------------------

create trigger event_registrations_academy before insert on public.event_registrations
  for each row execute function public.set_academy_from_student();

create or replace function public.check_same_academy()
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
  elsif tg_table_name = 'graduation_requirements' then
    select academy_id into v_other from public.belts where id = new.belt_id;
  elsif tg_table_name = 'waiver_signatures' then
    select academy_id into v_other from public.waiver_templates where id = new.template_id;
  elsif tg_table_name = 'attendance' then
    select academy_id into v_other from public.class_sessions where id = new.session_id;
  elsif tg_table_name = 'event_registrations' then
    select academy_id into v_other from public.events where id = new.event_id;
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

create trigger graduation_requirements_same_academy before insert or update on public.graduation_requirements
  for each row execute function public.check_same_academy();
create trigger event_registrations_same_academy before insert on public.event_registrations
  for each row execute function public.check_same_academy();

-- ---------------------------------------------------------------------------
-- Notificaciones automáticas
-- ---------------------------------------------------------------------------

create function public.on_event_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.academies where id = new.academy_id;
  perform public.notify_academy(
    new.academy_id, 'event', 'Nuevo evento: ' || new.title,
    to_char(new.starts_at at time zone v_tz, 'DD/MM "a las" HH24:MI')
      || coalesce(' · ' || new.location, ''),
    jsonb_build_object('event_id', new.id)
  );
  return new;
end;
$$;

create trigger events_notify after insert on public.events
  for each row execute function public.on_event_created();

create function public.on_announcement_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published_at <= now() then
    perform public.notify_academy(
      new.academy_id, new.kind,
      case when new.kind = 'technique' then 'Técnica de la semana: ' || new.title else new.title end,
      left(new.body, 180),
      jsonb_build_object('announcement_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger announcements_notify after insert on public.announcements
  for each row execute function public.on_announcement_created();

-- Recordatorio semanal de los eventos próximos (lo llama una tarea programada).
create function public.queue_event_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_count int := 0;
begin
  for v_event in
    select e.id, e.academy_id, e.title, e.starts_at, a.timezone
    from public.events e
    join public.academies a on a.id = e.academy_id
    where e.weekly_reminder
      and e.starts_at > now()
      and e.starts_at < now() + interval '60 days'
  loop
    perform public.notify_academy(
      v_event.academy_id, 'event_reminder', 'Recordatorio: ' || v_event.title,
      'Será el ' || to_char(v_event.starts_at at time zone v_event.timezone, 'DD/MM "a las" HH24:MI') || '.',
      jsonb_build_object('event_id', v_event.id)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Avisos diarios al staff: cumpleaños de hoy. Semanal: resumen de morosos (los lunes).
create function public.queue_staff_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in
    select s.academy_id, string_agg(s.first_name || ' ' || s.last_name, ', ') as names
    from public.students s
    join public.academies a on a.id = s.academy_id
    where s.status = 'active'
      and to_char(s.birth_date, 'MM-DD') = to_char(now() at time zone a.timezone, 'MM-DD')
    group by s.academy_id
  loop
    perform public.notify_staff(v_row.academy_id, 'birthday', 'Cumpleaños de hoy', v_row.names);
    v_count := v_count + 1;
  end loop;

  if extract(isodow from now()) = 1 then
    for v_row in
      select sb.academy_id, count(*) as overdue
      from public.student_balances sb
      join public.students s on s.id = sb.student_id and s.status = 'active'
      where sb.overdue_months > 0
      group by sb.academy_id
    loop
      perform public.notify_staff(
        v_row.academy_id, 'overdue_summary', 'Pagos atrasados',
        v_row.overdue || ' alumno(s) tienen mensualidades atrasadas.'
      );
      v_count := v_count + 1;
    end loop;
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Acciones (RPC)
-- ---------------------------------------------------------------------------

-- Inscribe a un alumno en un evento; si tiene valor, genera el cobro.
create function public.register_for_event(p_event uuid, p_student uuid)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_registration public.event_registrations;
  v_charge_id uuid;
begin
  select * into v_event from public.events where id = p_event;
  if v_event.id is null then
    raise exception 'Evento no encontrado' using errcode = 'P0002';
  end if;
  if not public.can_access_student(p_student)
    or not exists (select 1 from public.students where id = p_student and academy_id = v_event.academy_id and status = 'active') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  select * into v_registration from public.event_registrations where event_id = p_event and student_id = p_student;
  if v_registration.id is not null then
    return v_registration;
  end if;

  if v_event.price > 0 then
    insert into public.charges (academy_id, student_id, concept, description, amount, due_date, created_by)
    values (v_event.academy_id, p_student, 'event', v_event.title, v_event.price,
            (v_event.starts_at at time zone (select timezone from public.academies where id = v_event.academy_id))::date,
            auth.uid())
    returning id into v_charge_id;
  end if;

  insert into public.event_registrations (academy_id, event_id, student_id, charge_id)
  values (v_event.academy_id, p_event, p_student, v_charge_id)
  returning * into v_registration;

  return v_registration;
end;
$$;

-- Ranking de asistencia (nombre + inicial del apellido) en un rango de fechas.
create function public.attendance_ranking(p_academy uuid, p_from date, p_to date, p_limit int default 20)
returns table (student_id uuid, display_name text, classes int, rank int)
language sql
stable
security definer
set search_path = ''
as $$
  select ranked.student_id, ranked.display_name, ranked.classes, ranked.rank
  from (
    select
      s.id as student_id,
      s.first_name || ' ' || left(s.last_name, 1) || '.' as display_name,
      count(a.id)::int as classes,
      rank() over (order by count(a.id) desc)::int as rank
    from public.students s
    join public.attendance a on a.student_id = s.id
    join public.class_sessions cs on cs.id = a.session_id
    where s.academy_id = p_academy
      and s.status = 'active'
      and cs.date between p_from and p_to
    group by s.id
  ) ranked
  where public.is_member(p_academy)
  order by ranked.rank, ranked.display_name
  limit least(greatest(p_limit, 1), 100);
$$;

-- Resumen para el panel del profesor.
create function public.academy_dashboard(p_academy uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_month_start date;
  v_result jsonb;
begin
  if not public.is_staff(p_academy) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  select timezone into v_tz from public.academies where id = p_academy;
  v_month_start := date_trunc('month', now() at time zone v_tz)::date;

  select jsonb_build_object(
    'active_students', (select count(*) from public.students where academy_id = p_academy and status = 'active'),
    'pending_students', (select count(*) from public.students where academy_id = p_academy and status = 'pending'),
    'pending_requests', (select count(*) from public.memberships where academy_id = p_academy and status = 'pending'),
    'classes_this_month', (
      select count(*) from public.class_sessions
      where academy_id = p_academy and date >= v_month_start and status = 'scheduled'
    ),
    'attendance_this_month', (
      select count(*) from public.attendance a
      join public.class_sessions cs on cs.id = a.session_id
      where a.academy_id = p_academy and cs.date >= v_month_start
    ),
    'income_this_month', (
      select coalesce(sum(amount), 0) from public.payments
      where academy_id = p_academy and (paid_at at time zone v_tz)::date >= v_month_start
    ),
    'pending_amount', (
      select coalesce(sum(remaining), 0) from public.charge_balances
      where academy_id = p_academy and status = 'pending'
    ),
    'overdue_students', (
      select count(*) from public.student_balances sb
      join public.students s on s.id = sb.student_id
      where sb.academy_id = p_academy and s.status = 'active' and sb.overdue_months > 0
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.graduation_requirements enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.announcements enable row level security;
alter table public.documents enable row level security;

create policy "graduation_requirements_select" on public.graduation_requirements for select to authenticated
  using (public.is_member(academy_id));
create policy "graduation_requirements_write" on public.graduation_requirements for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "events_select" on public.events for select to authenticated
  using (public.is_member(academy_id));
create policy "events_write" on public.events for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "event_registrations_select" on public.event_registrations for select to authenticated
  using (public.can_access_student(student_id));
create policy "event_registrations_write" on public.event_registrations for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "announcements_select" on public.announcements for select to authenticated
  using (public.is_member(academy_id) and (published_at <= now() or public.is_staff(academy_id)));
create policy "announcements_write" on public.announcements for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

create policy "documents_select" on public.documents for select to authenticated
  using (public.is_member(academy_id));
create policy "documents_write" on public.documents for all to authenticated
  using (public.is_staff(academy_id))
  with check (public.is_staff(academy_id));

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke execute on function public.notify_academy(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.queue_event_reminders() from public, anon, authenticated;
revoke execute on function public.queue_staff_reminders() from public, anon, authenticated;
revoke execute on function public.on_event_created() from public, anon, authenticated;
revoke execute on function public.on_announcement_created() from public, anon, authenticated;

revoke execute on function public.register_for_event(uuid, uuid) from public, anon;
revoke execute on function public.attendance_ranking(uuid, date, date, int) from public, anon;
revoke execute on function public.academy_dashboard(uuid) from public, anon;
grant execute on function public.register_for_event(uuid, uuid) to authenticated;
grant execute on function public.attendance_ranking(uuid, date, date, int) to authenticated;
grant execute on function public.academy_dashboard(uuid) to authenticated;

-- La página web consulta las noticias sin iniciar sesión.
grant execute on function public.public_news(text, int) to anon, authenticated;
