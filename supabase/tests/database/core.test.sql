-- Pruebas del núcleo multi-academia: aislamiento entre academias y flujo de aprobación.
-- Ejecutar con: npx supabase test db

begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Usuarios de prueba
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'dueno.a@test.cl', '{"full_name": "Dueño A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'dueno.b@test.cl', '{"full_name": "Dueño B"}'),
  ('00000000-0000-0000-0000-000000000001', 'alumno@test.cl', '{"full_name": "Alumno Uno"}'),
  ('00000000-0000-0000-0000-000000000002', 'instructor@test.cl', '{"full_name": "Instructor"}'),
  ('00000000-0000-0000-0000-000000000003', 'alumno2@test.cl', '{"full_name": "Alumno Dos"}');

select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'Alumno Uno',
  'El perfil se crea automáticamente con el nombre del registro'
);

-- ---------------------------------------------------------------------------
-- Crear academias
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is((public.create_academy('Academia A')).name, 'Academia A', 'Dueño A crea su academia');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((public.create_academy('Academia B')).name, 'Academia B', 'Dueño B crea su academia');

reset role;
update public.academies set join_code = 'AAAAAA' where name = 'Academia A';
update public.academies set join_code = 'BBBBBB' where name = 'Academia B';

select is(
  (select count(*)::int from public.categories c join public.academies a on a.id = c.academy_id where a.name = 'Academia A'),
  4,
  'La academia nueva trae 4 categorías por edad'
);
select is(
  (select count(*)::int from public.belts b join public.academies a on a.id = b.academy_id where a.name = 'Academia A'),
  18,
  'La academia nueva trae 18 cinturones (5 adulto + 13 kids)'
);

-- ---------------------------------------------------------------------------
-- Aislamiento entre academias
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select array_agg(name) from public.academies), array['Academia A'], 'Dueño A solo ve su academia');
select is((select count(*)::int from public.belts), 18, 'Dueño A solo ve los cinturones de su academia');
select is((select count(*)::int from public.memberships), 1, 'Dueño A solo ve las membresías de su academia');

-- ---------------------------------------------------------------------------
-- Solicitud de ingreso de un alumno
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ select public.join_academy('ZZZZZZ') $$,
  'P0002', null,
  'Un código inválido es rechazado'
);
select throws_ok(
  $$ select public.join_academy('AAAAAA', 'owner') $$,
  '42501', null,
  'Nadie puede unirse como dueño'
);
select is((public.join_academy(' aaaaaa ')).status, 'pending'::public.membership_status, 'El alumno queda pendiente (código sin distinguir mayúsculas)');
select is((select array_agg(name) from public.academies), array['Academia A'], 'Con solicitud pendiente el alumno ve el nombre de la academia');
select is((select count(*)::int from public.categories), 0, 'Con solicitud pendiente el alumno aún no ve datos internos');
select throws_ok(
  $$ select public.review_membership((select id from public.memberships limit 1), true) $$,
  '42501', null,
  'El alumno no puede aprobarse a sí mismo'
);
select throws_ok(
  $$ insert into public.memberships (academy_id, user_id, role, status)
     select id, '00000000-0000-0000-0000-000000000001', 'owner', 'active' from public.academies $$,
  '42501', null,
  'No se pueden crear membresías directamente (solo vía RPC)'
);

-- Otro dueño no puede ver ni aprobar la solicitud.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  0,
  'Dueño B no ve el perfil de un alumno de la academia A'
);

reset role;
select id as alumno_membership from public.memberships where user_id = '00000000-0000-0000-0000-000000000001' \gset
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  format('select public.review_membership(%L, true)', :'alumno_membership'),
  '42501', null,
  'Dueño B no puede aprobar solicitudes de la academia A'
);

-- El dueño A ve la solicitud y la aprueba.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'Alumno Uno',
  'Dueño A ve el perfil del alumno que postula'
);
select is(
  (public.review_membership(:'alumno_membership', true)).status,
  'active'::public.membership_status,
  'Dueño A aprueba al alumno'
);

-- Ya aprobado, el alumno ve los datos de su academia pero no puede editarla.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.categories), 4, 'El alumno aprobado ve las categorías de su academia');
update public.academies set name = 'Hackeada';
select is((select name from public.academies), 'Academia A', 'El alumno no puede editar la academia');

-- ---------------------------------------------------------------------------
-- Instructores
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok($$ select public.join_academy('AAAAAA', 'instructor') $$, 'Un instructor solicita unirse');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
select lives_ok($$ select public.join_academy('AAAAAA', 'student') $$, 'Un segundo alumno solicita unirse');

reset role;
select id as instructor_membership from public.memberships where user_id = '00000000-0000-0000-0000-000000000002' \gset
select id as alumno2_membership from public.memberships where user_id = '00000000-0000-0000-0000-000000000003' \gset
set local role authenticated;

-- Un alumno activo no puede aprobar a otros.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select throws_ok(
  format('select public.review_membership(%L, true)', :'alumno2_membership'),
  '42501', null,
  'Un alumno no puede aprobar a otro alumno'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  format('select public.review_membership(%L, true)', :'instructor_membership'),
  'El dueño aprueba al instructor'
);

-- El instructor aprueba alumnos, pero no a otros instructores.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select is(
  (public.review_membership(:'alumno2_membership', true)).status,
  'active'::public.membership_status,
  'El instructor puede aprobar alumnos'
);

reset role;
insert into public.memberships (academy_id, user_id, role)
  select academy_id, '00000000-0000-0000-0000-000000000003', 'instructor'
  from public.memberships where id = :'alumno2_membership';
select id as instructor2_membership from public.memberships
  where user_id = '00000000-0000-0000-0000-000000000003' and role = 'instructor' \gset
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok(
  format('select public.review_membership(%L, true)', :'instructor2_membership'),
  '42501', null,
  'El instructor no puede aprobar a otros instructores'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
select throws_ok(
  format('select public.set_membership_status(%L, %L)', :'alumno2_membership', 'inactive'),
  '42501', null,
  'Un instructor no puede quitar el acceso a un miembro'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(
  (public.set_membership_status(:'instructor_membership', 'inactive')).status,
  'inactive'::public.membership_status,
  'El dueño quita el acceso a un instructor'
);
select throws_ok(
  $$ select public.set_membership_status(
       (select id from public.memberships where role = 'owner' limit 1), 'inactive') $$,
  '42501', null,
  'Nadie puede quitarle el acceso al dueño'
);

select lives_ok($$ select public.register_push_token('ExponentPushToken[abc]', 'android') $$,
  'El dueño registra el token push de su teléfono');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.register_push_token('ExponentPushToken[abc]', 'android') $$,
  'Otra cuenta inicia sesión en el mismo teléfono');
reset role;
select is(
  (select user_id from public.push_tokens where token = 'ExponentPushToken[abc]'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Un token push usado por otra cuenta pasa a la cuenta actual'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Usuarios anónimos
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$ select public.create_academy('Anónima') $$,
  '42501', null,
  'Un usuario sin sesión no puede crear academias'
);

reset role;
select * from finish();
rollback;
