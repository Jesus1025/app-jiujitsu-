-- Pruebas de las Fases 2 y 3: eventos, noticias, documentos, ranking, panel, graduación,
-- pruebas con nota, muro, tienda y cursos.

begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'dueno.a@test.cl', '{"full_name": "Dueño A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'dueno.b@test.cl', '{"full_name": "Dueño B"}'),
  ('00000000-0000-0000-0000-000000000001', 'alumno@test.cl', '{"full_name": "Alumno Uno"}');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select public.create_academy('Academia A') is not null as created \gset
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select public.create_academy('Academia B') is not null as created \gset

reset role;
update public.academies set join_code = 'AAAAAA', public_slug = 'academia-a' where name = 'Academia A';
select id as academy_a from public.academies where name = 'Academia A' \gset
select id as academy_b from public.academies where name = 'Academia B' \gset
select id as belt_a from public.belts where academy_id = :'academy_a' and track = 'adult' and name = 'Azul' \gset
select id as belt_b from public.belts where academy_id = :'academy_b' and track = 'adult' and name = 'Azul' \gset

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select public.join_academy('AAAAAA', 'student') is not null as joined \gset
reset role;
select id as membership_s from public.memberships where user_id = '00000000-0000-0000-0000-000000000001' \gset
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select public.review_membership(:'membership_s', true) is not null as approved \gset
insert into public.students (academy_id, user_id, first_name, last_name, birth_date, status)
values (:'academy_a', '00000000-0000-0000-0000-000000000001', 'Alumno', 'Uno', '1995-03-10', 'active');
reset role;
select id as student_s from public.students where user_id = '00000000-0000-0000-0000-000000000001' \gset
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select lives_ok(
  format($$ insert into public.events (academy_id, type, title, starts_at, price)
            values (%L, 'seminar', 'Seminario de guardia', now() + interval '10 days', 20000) $$, :'academy_a'),
  'El dueño crea un seminario con valor'
);
select id as event_a from public.events where title = 'Seminario de guardia' \gset

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.notifications where type = 'event'), 1,
  'El alumno recibe la notificación del evento nuevo');
select lives_ok(format('select public.register_for_event(%L, %L)', :'event_a', :'student_s'),
  'El alumno se inscribe en el seminario');
select is((select amount from public.charges where concept = 'event'), 20000,
  'La inscripción genera el cobro del seminario');
select lives_ok(format('select public.register_for_event(%L, %L)', :'event_a', :'student_s'),
  'Inscribirse dos veces no falla');
select is((select count(*)::int from public.charges where concept = 'event'), 1,
  'Inscribirse dos veces no duplica el cobro');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select throws_ok(format('select public.register_for_event(%L, %L)', :'event_a', :'student_s'),
  '42501', null, 'El dueño de otra academia no puede inscribir alumnos ajenos');
select is((select count(*)::int from public.events), 0, 'Dueño B no ve eventos de la academia A');

-- ---------------------------------------------------------------------------
-- Noticias y página web
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
insert into public.announcements (academy_id, kind, title, body, show_on_website)
values (:'academy_a', 'news', 'Promo noviembre', 'Trae a un amigo y paga la mitad.', true),
       (:'academy_a', 'technique', 'Raspada de tijera', 'Esta semana: raspada de tijera.', false);
insert into public.announcements (academy_id, title, published_at)
values (:'academy_a', 'Noticia programada', now() + interval '3 days');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.announcements), 2,
  'El alumno ve las noticias publicadas pero no las programadas');
select is((select count(*)::int from public.notifications where type = 'technique'), 1,
  'La técnica de la semana genera una notificación');

reset role;
set local role anon;
select is((select array_agg(title) from public.public_news('academia-a')), array['Promo noviembre'],
  'La web pública solo recibe las noticias marcadas para la web');
reset role;
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
insert into public.documents (academy_id, title, file_path, file_name)
values (:'academy_a', 'Reglamento', :'academy_a' || '/shared/documents/reglamento.pdf', 'reglamento.pdf');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.documents), 1, 'El alumno ve los documentos de su academia');
select throws_ok(
  format($$ insert into public.documents (academy_id, title, file_path, file_name) values (%L, 'X', 'x', 'x') $$, :'academy_a'),
  '42501', null, 'El alumno no puede subir documentos');

-- ---------------------------------------------------------------------------
-- Ranking y panel
-- ---------------------------------------------------------------------------

reset role;
insert into public.class_sessions (academy_id, date, starts_at, ends_at, title)
values (:'academy_a', current_date, now(), now() + interval '1 hour', 'Adultos');
insert into public.attendance (academy_id, session_id, student_id)
select :'academy_a', id, :'student_s' from public.class_sessions where academy_id = :'academy_a';
set local role authenticated;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is(
  (select display_name || ':' || classes from public.attendance_ranking(:'academy_a', current_date - 30, current_date)),
  'Alumno U.:1',
  'El ranking muestra nombre, inicial del apellido y clases'
);
select throws_ok(format('select public.academy_dashboard(%L)', :'academy_a'),
  '42501', null, 'El alumno no puede ver el panel del profesor');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select is((select count(*)::int from public.attendance_ranking(:'academy_a', current_date - 30, current_date)), 0,
  'Otra academia no ve el ranking');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select is((public.academy_dashboard(:'academy_a') ->> 'active_students')::int, 1,
  'El panel cuenta los alumnos activos');
select is((public.academy_dashboard(:'academy_a') ->> 'attendance_this_month')::int, 1,
  'El panel cuenta la asistencia del mes');

-- ---------------------------------------------------------------------------
-- Requisitos de graduación
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$ insert into public.graduation_requirements (academy_id, belt_id, degree, min_classes, min_months)
            values (%L, %L, 0, 150, 18) $$, :'academy_a', :'belt_a'),
  'El dueño define los requisitos para cinturón azul'
);
select throws_ok(
  format($$ insert into public.graduation_requirements (academy_id, belt_id, degree) values (%L, %L, 1) $$,
    :'academy_a', :'belt_b'),
  '23514', null, 'No se pueden usar cinturones de otra academia');

-- ---------------------------------------------------------------------------
-- Pruebas con nota
-- ---------------------------------------------------------------------------

select is(public.chilean_grade(6, 10), 4.0, 'Con 60 % de respuestas correctas la nota es 4,0');

insert into public.quizzes (academy_id, title) values (:'academy_a', 'Manual del alumno nuevo');
select id as quiz_a from public.quizzes where title = 'Manual del alumno nuevo' \gset
insert into public.quiz_questions (quiz_id, position, prompt, options)
values (:'quiz_a', 1, '¿Quién creó el Jiu-Jitsu brasileño?', '["Los Gracie", "Bruce Lee"]'),
       (:'quiz_a', 2, '¿Cuántos puntos vale una montada?', '["2", "4"]');
insert into public.quiz_answer_keys (question_id, correct_index)
select id, case when position = 1 then 0 else 1 end from public.quiz_questions where quiz_id = :'quiz_a';
select is(public.assign_quiz(:'quiz_a'), 1, 'El dueño asigna la prueba a los alumnos activos');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.quiz_answer_keys), 0, 'El alumno no puede ver las respuestas correctas');
select id as assignment_s from public.quiz_assignments where quiz_id = :'quiz_a' \gset
select is((public.submit_quiz(:'assignment_s', array[0, 0])).grade, 3.5,
  'Con 1 de 2 correctas la nota es 3,5');
select throws_ok(format('select public.submit_quiz(%L, array[0, 1])', :'assignment_s'),
  '22023', null, 'No se puede enviar la misma prueba dos veces');

-- ---------------------------------------------------------------------------
-- Muro
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$ insert into public.posts (academy_id, body) values (%L, '¡Excelente clase hoy!') $$, :'academy_a'),
  'El alumno publica en el muro'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b"}';
select is((select count(*)::int from public.posts), 0, 'Otra academia no ve el muro');

-- ---------------------------------------------------------------------------
-- Tienda
-- ---------------------------------------------------------------------------

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
insert into public.products (academy_id, name, price, stock) values (:'academy_a', 'Parche', 5000, 3);
select id as product_a from public.products where name = 'Parche' \gset
select is((public.sell_product(:'product_a', 2, :'student_s', true)).total, 10000,
  'Se venden 2 parches');
select is((select stock from public.products where id = :'product_a'), 1, 'El stock baja a 1');
select is((select count(*)::int from public.charges where concept = 'product'), 1,
  'La venta queda como cobro pendiente del alumno');
select throws_ok(format('select public.sell_product(%L, 5)', :'product_a'),
  '22023', null, 'No se puede vender más que el stock');

-- ---------------------------------------------------------------------------
-- Cursos
-- ---------------------------------------------------------------------------

insert into public.courses (academy_id, title, price, published) values (:'academy_a', 'Pasajes de guardia', 15000, true);
select id as course_a from public.courses where title = 'Pasajes de guardia' \gset
insert into public.course_lessons (course_id, position, title, video_url)
values (:'course_a', 1, 'Introducción', 'https://example.com/video.m3u8');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.courses), 1, 'El alumno ve el curso publicado');
select is((select count(*)::int from public.course_lessons), 0, 'Sin acceso no ve las lecciones');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a"}';
select lives_ok(format('select public.grant_course_access(%L, %L)', :'course_a', :'student_s'),
  'El dueño da acceso al curso');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from public.course_lessons), 1, 'Con acceso el alumno ve las lecciones');

-- ---------------------------------------------------------------------------
-- Tareas programadas
-- ---------------------------------------------------------------------------

reset role;
select lives_ok('select public.run_daily_jobs()', 'Las tareas diarias corren sin errores');
select lives_ok('select public.queue_event_reminders()', 'Los recordatorios de eventos corren sin errores');

select * from finish();
rollback;
