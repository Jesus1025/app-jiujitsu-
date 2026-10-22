-- Pruebas de las reglas configurables por academia (academies.settings).

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'dueno@test.cl', '{"full_name": "Dueño"}'),
  ('00000000-0000-0000-0000-000000000002', 'instructor@test.cl', '{"full_name": "Instructor"}'),
  ('00000000-0000-0000-0000-000000000001', 'alumno@test.cl', '{"full_name": "Alumno"}');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select public.create_academy('Academia A') is not null as created \gset

reset role;
update public.academies set join_code = 'AAAAAA', checkin_code = 'QRAAAA';
select id as academy_a from public.academies \gset
select id as blue_belt from public.belts where track = 'adult' and name = 'Azul' \gset

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002"}';
select public.join_academy('AAAAAA', 'instructor') is not null as joined \gset
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select public.join_academy('AAAAAA', 'student') is not null as joined \gset
reset role;
update public.memberships set status = 'active' where role <> 'owner';
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Guardar ajustes
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select throws_ok(
  $$ update public.academies set settings = '{"grace_days": 100}' $$,
  '22023', null,
  'Un ajuste fuera de rango es rechazado'
);
select lives_ok(
  $$ update public.academies set settings = '{"grace_days": 5, "enrollment_fee": 20000,
       "instructors_can_award_ranks": false, "show_ranking_to_students": false,
       "checkin_window_minutes": 60, "adult_belt_age": 18}' $$,
  'El dueño guarda las reglas de su academia'
);

-- ---------------------------------------------------------------------------
-- Matrícula automática y edad para cinturones de adulto
-- ---------------------------------------------------------------------------

insert into public.students (academy_id, user_id, first_name, last_name, birth_date, status, joined_at)
values (:'academy_a', '00000000-0000-0000-0000-000000000001', 'Alumno', 'Diecisiete',
        current_date - interval '17 years', 'active', current_date);
reset role;
select id as student_s from public.students \gset
set local role authenticated;

select is(
  (select b.track::text from public.rank_awards ra join public.belts b on b.id = ra.belt_id
   where ra.student_id = :'student_s'),
  'kids',
  'Con edad de adulto en 18, un alumno de 17 recibe cinturón kids'
);
select is(
  (select amount from public.charges where student_id = :'student_s' and concept = 'enrollment'),
  20000,
  'Al activar la ficha se cobra la matrícula configurada'
);

-- ---------------------------------------------------------------------------
-- Quién otorga grados
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002"}';
select throws_ok(
  format($$ insert into public.rank_awards (academy_id, student_id, belt_id) values (%L, %L, %L) $$,
    :'academy_a', :'student_s', :'blue_belt'),
  '42501', null,
  'Si el dueño lo desactiva, el instructor no puede otorgar grados'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select lives_ok(
  format($$ insert into public.rank_awards (academy_id, student_id, belt_id) values (%L, %L, %L) $$,
    :'academy_a', :'student_s', :'blue_belt'),
  'El dueño siempre puede otorgar grados'
);

-- ---------------------------------------------------------------------------
-- Ventana de asistencia y ranking
-- ---------------------------------------------------------------------------

insert into public.class_schedules (academy_id, weekday, start_time, end_time, title)
values (:'academy_a', 3, '19:00', '20:30', 'Adultos');

reset role;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is(
  (public.check_in_at(:'academy_a', 'QRAAAA', null, 'qr', '2026-10-21 18:10:00 America/Santiago')).is_late,
  false,
  'Con ventana de 60 minutos se puede marcar 50 minutos antes'
);
select throws_ok(
  format($$ select public.check_in_at(%L, 'QRAAAA', null, 'qr', '2026-10-28 17:50:00 America/Santiago') $$, :'academy_a'),
  'P0002', null,
  'Antes de la ventana no se puede marcar'
);

set local role authenticated;
select is(
  (select count(*)::int from public.attendance_ranking(:'academy_a', '2026-10-01', '2026-10-31')),
  0,
  'Si el dueño lo oculta, el alumno no ve el ranking'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select is(
  (select count(*)::int from public.attendance_ranking(:'academy_a', '2026-10-01', '2026-10-31')),
  1,
  'El staff siempre ve el ranking'
);

-- ---------------------------------------------------------------------------
-- Días de gracia
-- ---------------------------------------------------------------------------

insert into public.charges (academy_id, student_id, concept, period, amount, due_date)
values (:'academy_a', :'student_s', 'monthly', '2026-01', 30000, current_date - 3);
select is(
  (select overdue_months from public.student_balances where student_id = :'student_s'),
  0,
  'Dentro de los días de gracia la mensualidad no cuenta como atrasada'
);
update public.academies set settings = settings || '{"grace_days": 0}';
select is(
  (select overdue_months from public.student_balances where student_id = :'student_s'),
  1,
  'Sin días de gracia la misma mensualidad ya está atrasada'
);

reset role;
select lives_ok('select public.queue_payment_reminders()', 'Los recordatorios de pago corren con las reglas');

select * from finish();
rollback;
