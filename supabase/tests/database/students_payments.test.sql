-- Pruebas de la Fase 1: fichas, exoneración, grados, asistencia, pagos, notificaciones y archivos.

begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'dueno.a@test.cl', '{"full_name": "Dueño A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'dueno.b@test.cl', '{"full_name": "Dueño B"}'),
  ('00000000-0000-0000-0000-000000000001', 'alumno@test.cl', '{"full_name": "Alumno Uno"}'),
  ('00000000-0000-0000-0000-000000000002', 'apoderado@test.cl', '{"full_name": "Apoderada"}'),
  ('00000000-0000-0000-0000-000000000003', 'pedro@test.cl', '{"full_name": "Pedro"}');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select public.create_academy('Academia A') is not null as created \gset
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select public.create_academy('Academia B') is not null as created \gset

reset role;
update public.academies set join_code = 'AAAAAA', checkin_code = 'QRAAAA' where name = 'Academia A';
select id as academy_a from public.academies where name = 'Academia A' \gset
select id as academy_b from public.academies where name = 'Academia B' \gset
select id as blue_belt from public.belts where academy_id = :'academy_a' and track = 'adult' and name = 'Azul' \gset
select id as plan_a from public.fee_plans where academy_id = :'academy_a' \gset
select id as waiver_a from public.waiver_templates where academy_id = :'academy_a' \gset

select is((select count(*)::int from public.waiver_templates where academy_id = :'academy_a'), 1,
  'La academia nueva trae una exoneración');
select is((select count(*)::int from public.fee_plans where academy_id = :'academy_a'), 1,
  'La academia nueva trae un plan de mensualidad');

-- ---------------------------------------------------------------------------
-- Fichas
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select public.join_academy('AAAAAA', 'student') is not null as joined \gset

select lives_ok(
  format($$ insert into public.students (academy_id, user_id, first_name, last_name, birth_date)
            values (%L, '00000000-0000-0000-0000-000000000001', 'Alumno', 'Uno', '1995-03-10') $$, :'academy_a'),
  'El alumno crea su propia ficha pendiente'
);
select throws_ok(
  format($$ insert into public.students (academy_id, user_id, first_name, last_name, birth_date, status)
            values (%L, '00000000-0000-0000-0000-000000000001', 'X', 'Y', '1995-03-10', 'active') $$, :'academy_a'),
  '42501', null,
  'El alumno no puede crearse una ficha ya activa'
);
select throws_ok(
  format($$ insert into public.students (academy_id, user_id, first_name, last_name, birth_date)
            values (%L, '00000000-0000-0000-0000-000000000003', 'Otro', 'Usuario', '1990-01-01') $$, :'academy_a'),
  '42501', null,
  'El alumno no puede crear fichas a nombre de otro usuario'
);
select throws_ok(
  format($$ insert into public.students (academy_id, user_id, first_name, last_name, birth_date)
            values (%L, '00000000-0000-0000-0000-000000000001', 'Alumno', 'Uno', '1995-03-10') $$, :'academy_b'),
  '42501', null,
  'No se puede crear una ficha en una academia a la que no se postuló'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002"}';
select public.join_academy('AAAAAA', 'guardian') is not null as joined \gset
select lives_ok(
  format($$ insert into public.students (academy_id, guardian_user_id, first_name, last_name, birth_date)
            values (%L, '00000000-0000-0000-0000-000000000002', 'Hijo', 'Menor', '2017-06-01') $$, :'academy_a'),
  'El apoderado crea la ficha de su hijo'
);

reset role;
select id as student_s from public.students where user_id = '00000000-0000-0000-0000-000000000001' \gset
select id as student_child from public.students where guardian_user_id = '00000000-0000-0000-0000-000000000002' \gset
select id as membership_s from public.memberships where user_id = '00000000-0000-0000-0000-000000000001' \gset
set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select is((select count(*)::int from public.students), 0, 'Dueño B no ve fichas de la academia A');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select is((select count(*)::int from public.students), 2, 'Dueño A ve las dos fichas pendientes');
select is(
  (select count(*)::int from public.notifications where type = 'membership_request'),
  2,
  'El dueño recibe una notificación por cada solicitud'
);
select lives_ok(format('select public.review_membership(%L, true)', :'membership_s'), 'Dueño A aprueba al alumno');
select is(
  (select status from public.students where id = :'student_s'),
  'active'::public.student_status,
  'Al aprobar la membresía se activa la ficha del alumno'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.students), 1, 'El alumno solo ve su propia ficha');
select is(
  (select b.name from public.rank_awards ra join public.belts b on b.id = ra.belt_id where ra.student_id = :'student_s'),
  'Blanco',
  'Al aprobar la ficha se asigna el cinturón blanco inicial'
);
select throws_ok(
  format($$ update public.students set status = 'inactive' where id = %L $$, :'student_s'),
  '42501', null,
  'El alumno no puede cambiar el estado de su ficha'
);
select lives_ok(
  format($$ update public.students set phone = '+56911112222' where id = %L $$, :'student_s'),
  'El alumno puede actualizar su teléfono'
);
select is(
  (select count(*)::int from public.notifications where type = 'membership_approved'),
  1,
  'El alumno recibe la notificación de aprobación'
);

-- ---------------------------------------------------------------------------
-- Exoneración
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$ insert into public.waiver_signatures (student_id, template_id, signer_name, signer_relationship, signature_svg)
            values (%L, %L, 'Alumno Uno', 'self', 'M0 0 L10 10') $$, :'student_s', :'waiver_a'),
  'El alumno firma su exoneración'
);
select throws_ok(
  format($$ insert into public.waiver_signatures (student_id, template_id, signer_name, signer_relationship, signature_svg)
            values (%L, %L, 'Alumno Uno', 'guardian', 'M0 0 L10 10') $$, :'student_child', :'waiver_a'),
  '42501', null,
  'El alumno no puede firmar por el hijo de otra persona'
);

-- ---------------------------------------------------------------------------
-- Grados
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$ insert into public.rank_awards (student_id, belt_id) values (%L, %L) $$, :'student_s', :'blue_belt'),
  '42501', null,
  'El alumno no puede otorgarse grados'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select lives_ok(
  format($$ insert into public.rank_awards (academy_id, student_id, belt_id, degree) values (%L, %L, %L, 1) $$,
    :'academy_a', :'student_s', :'blue_belt'),
  'El dueño otorga cinturón azul 1° grado'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select throws_ok(
  format($$ insert into public.rank_awards (student_id, belt_id) values (%L, %L) $$, :'student_s', :'blue_belt'),
  '42501', null,
  'El dueño de otra academia no puede otorgar grados'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is(
  (select belt_id from public.student_progress where student_id = :'student_s'),
  :'blue_belt'::uuid,
  'El progreso del alumno muestra su cinturón actual'
);
select is(
  (select count(*)::int from public.notifications where type = 'rank_award'),
  1,
  'El alumno recibe una notificación al subir de grado'
);

-- ---------------------------------------------------------------------------
-- Asistencia con QR (hora fija: miércoles 21-10-2026)
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select lives_ok(
  format($$ insert into public.class_schedules (academy_id, weekday, start_time, end_time, title)
            values (%L, 3, '19:00', '20:30', 'Adultos') $$, :'academy_a'),
  'El dueño crea la clase de los miércoles'
);

reset role;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is(
  (public.check_in_at(:'academy_a', 'qraaaa', null, 'qr', '2026-10-21 19:30:00 America/Santiago')).is_late,
  true,
  'Marcar a las 19:30 en una clase de las 19:00 queda como atraso'
);
select throws_ok(
  format($$ select public.check_in_at(%L, 'QRAAAA', null, 'qr', '2026-10-21 19:40:00 America/Santiago') $$, :'academy_a'),
  '23505', null,
  'No se puede marcar dos veces la misma clase'
);
select throws_ok(
  format($$ select public.check_in_at(%L, 'ZZZZZZ', null, 'qr', '2026-10-21 19:30:00 America/Santiago') $$, :'academy_a'),
  'P0002', null,
  'Un código de asistencia inválido es rechazado'
);
select throws_ok(
  format($$ select public.check_in_at(%L, 'QRAAAA', null, 'qr', '2026-10-21 12:00:00 America/Santiago') $$, :'academy_a'),
  'P0002', null,
  'Fuera del horario de clases no se puede marcar'
);
select is(
  (public.check_in_at(:'academy_a', 'QRAAAA', null, 'qr', '2026-10-28 18:45:00 America/Santiago')).is_late,
  false,
  'Marcar 15 minutos antes no es atraso'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
insert into public.class_schedules (academy_id, weekday, start_time, end_time, title)
values (:'academy_a', 4, '00:05', '01:00', 'Clase de medianoche');
reset role;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is(
  (public.check_in_at(:'academy_a', 'QRAAAA', null, 'qr', '2026-10-22 00:20:00 America/Santiago')).is_late,
  true,
  'Una clase que empieza justo después de medianoche también acepta asistencia'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select throws_ok(
  'select checkin_code from public.academies',
  '42501', null,
  'El alumno no puede leer el código del QR de asistencia'
);
select throws_ok(
  format('select public.get_checkin_code(%L)', :'academy_a'),
  '42501', null,
  'El alumno no puede pedir el código del QR por RPC'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select is(public.get_checkin_code(:'academy_a'), 'QRAAAA', 'El dueño obtiene el código del QR');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is(
  (select total_classes from public.student_progress where student_id = :'student_s'),
  3,
  'El progreso cuenta las clases asistidas'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select is((select count(*)::int from public.attendance), 0, 'Dueño B no ve la asistencia de la academia A');

-- ---------------------------------------------------------------------------
-- Pagos
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
update public.fee_plans set amount = 30000 where id = :'plan_a';
update public.students set fee_plan_id = :'plan_a' where id = :'student_s';
select lives_ok(
  format('select public.register_referral(%L, %L, 50)', :'student_s', :'student_child'),
  'El dueño registra que el alumno trajo a un nuevo alumno'
);
select is(public.generate_monthly_charges(:'academy_a', '2026-11'), 1,
  'Se genera una mensualidad (solo el alumno activo con plan)');
select is(public.generate_monthly_charges(:'academy_a', '2026-11'), 0,
  'Generar dos veces el mismo mes no duplica cobros');
select is(
  (select discount from public.charges where student_id = :'student_s' and period = '2026-11'),
  15000,
  'El descuento por referido (50 %) se aplica a la mensualidad'
);

select id as charge_s from public.charges where student_id = :'student_s' and period = '2026-11' \gset

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select remaining from public.charge_balances where id = :'charge_s'), 15000,
  'El alumno ve su deuda pendiente');
select throws_ok(
  format($$ insert into public.payments (charge_id, amount) values (%L, 15000) $$, :'charge_s'),
  '42501', null,
  'El alumno no puede registrar pagos'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002"}';
select is((select count(*)::int from public.charges), 0, 'La apoderada no ve cobros de otros alumnos');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
insert into public.payments (charge_id, amount, method) values (:'charge_s', 15000, 'transfer');
select is((select status from public.charges where id = :'charge_s'), 'paid'::public.charge_status,
  'Al pagar el total el cobro queda pagado');
select is((select pending_amount from public.student_balances where student_id = :'student_s'), 0,
  'El saldo del alumno queda en cero');

-- ---------------------------------------------------------------------------
-- Archivos
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select ok(public.storage_can_read(:'academy_a' || '/students/' || :'student_s' || '/foto.jpg'),
  'El alumno puede ver su propia foto');
select ok(not public.storage_can_read(:'academy_a' || '/students/' || :'student_child' || '/foto.jpg'),
  'El alumno no puede ver la foto de otro alumno');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select ok(not public.storage_can_read(:'academy_a' || '/shared/reglamento.pdf'),
  'Otra academia no puede leer los documentos de la academia A');

-- ---------------------------------------------------------------------------
-- Vincular cuenta a una ficha cargada por el profesor
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
insert into public.students (academy_id, first_name, last_name, birth_date, status)
values (:'academy_a', 'Pedro', 'Pérez', '1988-08-08', 'active');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000003"}';
select public.join_academy('AAAAAA', 'student') is not null as joined \gset
insert into public.students (academy_id, user_id, first_name, last_name, birth_date)
values (:'academy_a', '00000000-0000-0000-0000-000000000003', 'Pedro', 'Pérez', '1988-08-08');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select lives_ok(
  $$ select public.link_student_account(
       (select id from public.students where first_name = 'Pedro' and user_id is null),
       '00000000-0000-0000-0000-000000000003') $$,
  'El dueño vincula la cuenta de Pedro con la ficha que ya había cargado'
);
select is(
  (select count(*)::int from public.students where first_name = 'Pedro'),
  1,
  'La ficha duplicada que creó Pedro se elimina'
);

reset role;
select * from finish();
rollback;
