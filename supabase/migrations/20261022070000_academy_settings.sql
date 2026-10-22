-- Reglas configurables por academia, guardadas en academies.settings (jsonb).
-- Cada clave tiene un valor por defecto; si no está definida, se usa ese valor:
--
--   grace_days                   int   0     días de gracia antes de contar una mensualidad como atrasada
--   enrollment_fee               int   0     matrícula que se cobra sola al activar la ficha (0 = no)
--   checkin_window_minutes       int   30    minutos antes de la clase desde los que se puede marcar con QR
--   adult_belt_age               int   16    edad desde la que se usan los cinturones de adulto
--   instructors_can_award_ranks  bool  true  los instructores pueden otorgar grados
--   show_ranking_to_students     bool  true  los alumnos ven el ranking de asistencia
--   referral_percent             int   50    descuento sugerido por referido (lo usa la app)
--   require_rut                  bool  false la ficha exige RUT (lo valida la app)
--   require_photo                bool  true  la ficha exige foto (lo valida la app)
--   require_emergency_contact    bool  true  la ficha exige contacto de emergencia (lo valida la app)

create function public.academy_setting_int(p_academy uuid, p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (settings ->> p_key)::int from public.academies where id = p_academy), p_default);
$$;

create function public.academy_setting_bool(p_academy uuid, p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (settings ->> p_key)::boolean from public.academies where id = p_academy), p_default);
$$;

-- Validación básica de las reglas al guardarlas.
create function public.validate_academy_settings()
returns trigger
language plpgsql
as $$
begin
  if jsonb_typeof(new.settings) <> 'object' then
    raise exception 'Ajustes inválidos' using errcode = '22023';
  end if;
  if coalesce((new.settings ->> 'grace_days')::int, 0) not between 0 and 60
    or coalesce((new.settings ->> 'enrollment_fee')::int, 0) < 0
    or coalesce((new.settings ->> 'checkin_window_minutes')::int, 30) not between 0 and 180
    or coalesce((new.settings ->> 'adult_belt_age')::int, 16) not between 10 and 21
    or coalesce((new.settings ->> 'referral_percent')::int, 50) not between 1 and 100 then
    raise exception 'Algún ajuste está fuera de rango' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger academies_validate_settings before insert or update of settings on public.academies
  for each row execute function public.validate_academy_settings();

-- ---------------------------------------------------------------------------
-- Días de gracia: una mensualidad cuenta como atrasada después de vencimiento + gracia.
-- ---------------------------------------------------------------------------

create or replace view public.student_balances
with (security_invoker = true)
as
select
  s.id as student_id,
  s.academy_id,
  coalesce(sum(cb.remaining) filter (where cb.status = 'pending'), 0)::int as pending_amount,
  count(*) filter (where cb.status = 'pending')::int as pending_count,
  count(*) filter (
    where cb.status = 'pending'
      and cb.concept = 'monthly'
      and cb.due_date + public.academy_setting_int(s.academy_id, 'grace_days', 0) < current_date
  )::int as overdue_months,
  min(cb.due_date) filter (where cb.status = 'pending') as oldest_due_date
from public.students s
left join public.charge_balances cb on cb.student_id = s.id
group by s.id, s.academy_id;

create or replace function public.queue_payment_reminders()
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
           (current_date - cb.due_date) as days_late,
           (current_date - (cb.due_date + public.academy_setting_int(cb.academy_id, 'grace_days', 0))) as days_overdue
    from public.charge_balances cb
    where cb.status = 'pending'
      and cb.remaining > 0
  loop
    -- 3 días antes, el día que vence y, pasada la gracia, una vez por semana.
    if v_charge.days_late = -3
      or v_charge.days_late = 0
      or (v_charge.days_overdue > 0 and v_charge.days_overdue % 7 = 1) then
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
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Activar una ficha: cinturón inicial según la edad de adulto y matrícula automática.
-- ---------------------------------------------------------------------------

create or replace function public.assign_initial_belt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_belt uuid;
  v_fee int;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if not exists (select 1 from public.rank_awards where student_id = new.id) then
    select id into v_belt
    from public.belts
    where academy_id = new.academy_id
      and track = case
        when extract(year from age(new.joined_at, new.birth_date))
             < public.academy_setting_int(new.academy_id, 'adult_belt_age', 16)
          then 'kids'::public.belt_track
        else 'adult'::public.belt_track
      end
    order by sort_order
    limit 1;

    if v_belt is not null then
      insert into public.rank_awards (academy_id, student_id, belt_id, degree, awarded_at, awarded_by, notes)
      values (new.academy_id, new.id, v_belt, 0, new.joined_at, null, 'Cinturón inicial');
    end if;
  end if;

  v_fee := public.academy_setting_int(new.academy_id, 'enrollment_fee', 0);
  if v_fee > 0 and not exists (
    select 1 from public.charges where student_id = new.id and concept = 'enrollment'
  ) then
    insert into public.charges (academy_id, student_id, concept, description, amount, due_date, created_by)
    values (new.academy_id, new.id, 'enrollment', 'Matrícula', v_fee, current_date, auth.uid());
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ventana de asistencia configurable.
-- ---------------------------------------------------------------------------

create or replace function public.check_in_at(
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
  v_window interval;
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
  v_window := make_interval(mins => public.academy_setting_int(p_academy, 'checkin_window_minutes', 30));

  -- Clase de hoy que empieza dentro de la ventana o que está en curso; la más cercana al inicio.
  select * into v_schedule
  from public.class_schedules cs
  where cs.academy_id = p_academy
    and cs.active
    and cs.weekday = extract(dow from v_local)::int
    and v_local between (v_local::date + cs.start_time) - v_window
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

-- ---------------------------------------------------------------------------
-- Quién otorga grados y quién ve el ranking.
-- ---------------------------------------------------------------------------

create function public.can_award_ranks(p_academy uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_academy, array['owner']::public.member_role[])
    or (
      public.has_role(p_academy, array['instructor']::public.member_role[])
      and public.academy_setting_bool(p_academy, 'instructors_can_award_ranks', true)
    );
$$;

drop policy "rank_awards_write" on public.rank_awards;
create policy "rank_awards_write" on public.rank_awards for all to authenticated
  using (public.can_award_ranks(academy_id))
  with check (public.can_award_ranks(academy_id));

create or replace function public.attendance_ranking(p_academy uuid, p_from date, p_to date, p_limit int default 20)
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
  where public.is_staff(p_academy)
     or (public.is_member(p_academy) and public.academy_setting_bool(p_academy, 'show_ranking_to_students', true))
  order by ranked.rank, ranked.display_name
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Logo de la academia: se guarda en {academy_id}/shared/branding/… (ya cubierto por Storage).
-- ---------------------------------------------------------------------------

revoke execute on function public.academy_setting_int(uuid, text, int) from public, anon;
revoke execute on function public.academy_setting_bool(uuid, text, boolean) from public, anon;
revoke execute on function public.can_award_ranks(uuid) from public, anon;
grant execute on function public.academy_setting_int(uuid, text, int) to authenticated;
grant execute on function public.academy_setting_bool(uuid, text, boolean) to authenticated;
grant execute on function public.can_award_ranks(uuid) to authenticated;
