-- Fase 3: pruebas con nota, muro de la comunidad, tienda/inventario y cursos en video.

-- ---------------------------------------------------------------------------
-- Pruebas (tests) sobre el manual del alumno
-- ---------------------------------------------------------------------------

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  -- Si tiene valor, se asigna sola a los alumnos que cumplen esos meses desde su ingreso.
  auto_send_after_months int check (auto_send_after_months between 1 and 120),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position int not null default 0,
  prompt text not null check (length(trim(prompt)) > 0),
  -- Alternativas como arreglo JSON de textos.
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6)
);

create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

-- Respuestas correctas aparte, para que los alumnos no puedan leerlas.
create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  academy_id uuid not null references public.academies (id) on delete cascade,
  correct_index int not null check (correct_index >= 0)
);

create table public.quiz_assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  answers jsonb,
  correct_count int,
  question_count int,
  -- Nota chilena de 1,0 a 7,0 (exigencia 60 %).
  grade numeric(2, 1) check (grade between 1.0 and 7.0),
  submitted_at timestamptz,
  unique (quiz_id, student_id)
);

create index quiz_assignments_student_idx on public.quiz_assignments (student_id);

-- Nota en escala 1,0–7,0 con 60 % de exigencia para el 4,0.
create function public.chilean_grade(p_correct int, p_total int)
returns numeric
language sql
immutable
as $$
  select case
    when p_total <= 0 then 1.0
    when p_correct::numeric / p_total < 0.6
      then round(1 + 3 * (p_correct::numeric / p_total) / 0.6, 1)
    else round(4 + 3 * ((p_correct::numeric / p_total) - 0.6) / 0.4, 1)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Muro de la comunidad (comentarios y testimonios)
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index posts_academy_idx on public.posts (academy_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Tienda e inventario
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  price int not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_sales (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  student_id uuid references public.students (id) on delete set null,
  quantity int not null check (quantity > 0),
  unit_price int not null check (unit_price >= 0),
  total int not null check (total >= 0),
  charge_id uuid references public.charges (id) on delete set null,
  sold_by uuid references public.profiles (id) on delete set null default auth.uid(),
  sold_at timestamptz not null default now()
);

create index product_sales_academy_idx on public.product_sales (academy_id, sold_at desc);

-- ---------------------------------------------------------------------------
-- Cursos en video
-- ---------------------------------------------------------------------------

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  price int not null default 0 check (price >= 0),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null default 0,
  title text not null check (length(trim(title)) > 0),
  description text,
  -- URL de streaming (MP4/HLS). Ver docs/PLAN.md §10 sobre protección de videos.
  video_url text not null
);

create index course_lessons_course_idx on public.course_lessons (course_id, position);

create table public.course_access (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  charge_id uuid references public.charges (id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (course_id, student_id)
);

-- ¿El usuario actual tiene acceso al curso (staff, o alumno/apoderado con acceso otorgado)?
create function public.has_course_access(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and public.is_staff(c.academy_id)
  )
  or exists (
    select 1
    from public.course_access ca
    join public.students s on s.id = ca.student_id
    where ca.course_id = p_course
      and (s.user_id = auth.uid() or s.guardian_user_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Integridad: academy_id desde la tabla padre
-- ---------------------------------------------------------------------------

create function public.set_academy_from_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'quiz_questions' then
    select academy_id into new.academy_id from public.quizzes where id = new.quiz_id;
  elsif tg_table_name = 'quiz_answer_keys' then
    select academy_id into new.academy_id from public.quiz_questions where id = new.question_id;
  elsif tg_table_name = 'course_lessons' then
    select academy_id into new.academy_id from public.courses where id = new.course_id;
  end if;
  if new.academy_id is null then
    raise exception 'Registro padre no encontrado' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger quiz_questions_academy before insert on public.quiz_questions
  for each row execute function public.set_academy_from_parent();
create trigger quiz_answer_keys_academy before insert on public.quiz_answer_keys
  for each row execute function public.set_academy_from_parent();
create trigger course_lessons_academy before insert on public.course_lessons
  for each row execute function public.set_academy_from_parent();

-- ---------------------------------------------------------------------------
-- Acciones (RPC)
-- ---------------------------------------------------------------------------

-- Asigna una prueba a alumnos (todos los activos si p_students es null).
create function public.assign_quiz(p_quiz uuid, p_students uuid[] default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes;
  v_ids uuid[];
  v_count int;
begin
  select * into v_quiz from public.quizzes where id = p_quiz;
  if v_quiz.id is null or not public.is_staff(v_quiz.academy_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  with inserted as (
    insert into public.quiz_assignments (academy_id, quiz_id, student_id)
    select v_quiz.academy_id, v_quiz.id, s.id
    from public.students s
    where s.academy_id = v_quiz.academy_id
      and s.status = 'active'
      and (p_students is null or s.id = any (p_students))
    on conflict (quiz_id, student_id) do nothing
    returning student_id
  )
  select array_agg(student_id) into v_ids from inserted;

  v_count := coalesce(array_length(v_ids, 1), 0);
  perform public.notify_student(sid, 'quiz', 'Tienes una prueba nueva', v_quiz.title, jsonb_build_object('quiz_id', v_quiz.id))
  from unnest(coalesce(v_ids, '{}'::uuid[])) as sid;

  return v_count;
end;
$$;

-- El alumno (o su apoderado) envía sus respuestas; la nota se calcula en el servidor.
create function public.submit_quiz(p_assignment uuid, p_answers int[])
returns public.quiz_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.quiz_assignments;
  v_total int;
  v_correct int;
begin
  select * into v_assignment from public.quiz_assignments where id = p_assignment;
  if v_assignment.id is null
    or not exists (
      select 1 from public.students s
      where s.id = v_assignment.student_id and (s.user_id = auth.uid() or s.guardian_user_id = auth.uid())
    ) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if v_assignment.submitted_at is not null then
    raise exception 'La prueba ya fue enviada' using errcode = '22023';
  end if;

  with ordered as (
    select q.id, row_number() over (order by q.position, q.id) as n
    from public.quiz_questions q
    where q.quiz_id = v_assignment.quiz_id
  )
  select count(*), count(*) filter (where k.correct_index = p_answers[o.n])
  into v_total, v_correct
  from ordered o
  join public.quiz_answer_keys k on k.question_id = o.id;

  update public.quiz_assignments
  set answers = to_jsonb(p_answers),
      correct_count = v_correct,
      question_count = v_total,
      grade = public.chilean_grade(v_correct, v_total),
      submitted_at = now()
  where id = p_assignment
  returning * into v_assignment;

  return v_assignment;
end;
$$;

-- Asignación automática de pruebas según meses desde el ingreso (tarea programada diaria).
create function public.auto_assign_quizzes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with inserted as (
    insert into public.quiz_assignments (academy_id, quiz_id, student_id)
    select q.academy_id, q.id, s.id
    from public.quizzes q
    join public.students s on s.academy_id = q.academy_id and s.status = 'active'
    where q.auto_send_after_months is not null
      and s.joined_at + make_interval(months => q.auto_send_after_months) <= current_date
    on conflict (quiz_id, student_id) do nothing
    returning quiz_id, student_id
  ),
  notified as (
    select public.notify_student(i.student_id, 'quiz', 'Tienes una prueba nueva', q.title, jsonb_build_object('quiz_id', q.id))
    from inserted i
    join public.quizzes q on q.id = i.quiz_id
  )
  select count(*) into v_count from notified;
  return v_count;
end;
$$;

-- Venta de un producto: descuenta stock y, si se indica alumno, puede dejarlo como cobro pendiente.
create function public.sell_product(p_product uuid, p_quantity int, p_student uuid default null, p_as_charge boolean default false)
returns public.product_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_sale public.product_sales;
  v_charge_id uuid;
begin
  select * into v_product from public.products where id = p_product for update;
  if v_product.id is null or not public.is_staff(v_product.academy_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_quantity <= 0 then
    raise exception 'Cantidad inválida' using errcode = '22023';
  end if;
  if v_product.stock < p_quantity then
    raise exception 'No hay stock suficiente (quedan %)', v_product.stock using errcode = '22023';
  end if;
  if p_student is not null and not exists (
    select 1 from public.students where id = p_student and academy_id = v_product.academy_id
  ) then
    raise exception 'Alumno no encontrado' using errcode = 'P0002';
  end if;

  update public.products set stock = stock - p_quantity where id = p_product;

  if p_as_charge and p_student is not null then
    insert into public.charges (academy_id, student_id, concept, description, amount, created_by)
    values (v_product.academy_id, p_student, 'product', p_quantity || ' × ' || v_product.name,
            v_product.price * p_quantity, auth.uid())
    returning id into v_charge_id;
  end if;

  insert into public.product_sales (academy_id, product_id, student_id, quantity, unit_price, total, charge_id)
  values (v_product.academy_id, p_product, p_student, p_quantity, v_product.price, v_product.price * p_quantity, v_charge_id)
  returning * into v_sale;

  return v_sale;
end;
$$;

-- Da acceso a un curso; opcionalmente genera el cobro por su valor.
create function public.grant_course_access(p_course uuid, p_student uuid, p_create_charge boolean default true)
returns public.course_access
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses;
  v_access public.course_access;
  v_charge_id uuid;
begin
  select * into v_course from public.courses where id = p_course;
  if v_course.id is null or not public.is_staff(v_course.academy_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students where id = p_student and academy_id = v_course.academy_id) then
    raise exception 'Alumno no encontrado' using errcode = 'P0002';
  end if;

  select * into v_access from public.course_access where course_id = p_course and student_id = p_student;
  if v_access.id is not null then
    return v_access;
  end if;

  if p_create_charge and v_course.price > 0 then
    insert into public.charges (academy_id, student_id, concept, description, amount, created_by)
    values (v_course.academy_id, p_student, 'course', 'Curso: ' || v_course.title, v_course.price, auth.uid())
    returning id into v_charge_id;
  end if;

  insert into public.course_access (academy_id, course_id, student_id, charge_id)
  values (v_course.academy_id, p_course, p_student, v_charge_id)
  returning * into v_access;

  perform public.notify_student(p_student, 'course_access', 'Curso disponible', v_course.title,
    jsonb_build_object('course_id', v_course.id));

  return v_access;
end;
$$;

-- El alumno pide un curso: se avisa al staff para que otorgue el acceso.
create function public.request_course(p_course uuid, p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses;
  v_name text;
begin
  select * into v_course from public.courses where id = p_course and published;
  if v_course.id is null then
    raise exception 'Curso no encontrado' using errcode = 'P0002';
  end if;
  select first_name || ' ' || last_name into v_name
  from public.students
  where id = p_student and academy_id = v_course.academy_id
    and (user_id = auth.uid() or guardian_user_id = auth.uid());
  if v_name is null then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  perform public.notify_staff(v_course.academy_id, 'course_request', 'Solicitud de curso',
    v_name || ' quiere el curso "' || v_course.title || '".',
    jsonb_build_object('course_id', v_course.id, 'student_id', p_student));
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_assignments enable row level security;
alter table public.posts enable row level security;
alter table public.products enable row level security;
alter table public.product_sales enable row level security;
alter table public.courses enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_access enable row level security;

create policy "quizzes_select" on public.quizzes for select to authenticated
  using (public.is_member(academy_id));
create policy "quizzes_write" on public.quizzes for all to authenticated
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

create policy "quiz_questions_select" on public.quiz_questions for select to authenticated
  using (public.is_member(academy_id));
create policy "quiz_questions_write" on public.quiz_questions for all to authenticated
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

create policy "quiz_answer_keys_staff" on public.quiz_answer_keys for all to authenticated
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

create policy "quiz_assignments_select" on public.quiz_assignments for select to authenticated
  using (public.can_access_student(student_id));
create policy "quiz_assignments_write" on public.quiz_assignments for all to authenticated
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

create policy "posts_select" on public.posts for select to authenticated
  using (public.is_member(academy_id));
create policy "posts_insert" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_member(academy_id));
create policy "posts_delete" on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_staff(academy_id));

create policy "products_select" on public.products for select to authenticated
  using (public.is_member(academy_id) and (active or public.is_staff(academy_id)));
create policy "products_write" on public.products for all to authenticated
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

create policy "product_sales_select" on public.product_sales for select to authenticated
  using (public.is_staff(academy_id));

create policy "courses_select" on public.courses for select to authenticated
  using (public.is_member(academy_id) and (published or public.is_staff(academy_id)));
create policy "courses_write" on public.courses for all to authenticated
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

create policy "course_lessons_select" on public.course_lessons for select to authenticated
  using (public.has_course_access(course_id));
create policy "course_lessons_write" on public.course_lessons for all to authenticated
  using (public.is_staff(academy_id)) with check (public.is_staff(academy_id));

create policy "course_access_select" on public.course_access for select to authenticated
  using (public.can_access_student(student_id));
create policy "course_access_delete" on public.course_access for delete to authenticated
  using (public.is_staff(academy_id));

-- ---------------------------------------------------------------------------
-- Permisos de funciones
-- ---------------------------------------------------------------------------

revoke execute on function public.auto_assign_quizzes() from public, anon, authenticated;

revoke execute on function public.assign_quiz(uuid, uuid[]) from public, anon;
revoke execute on function public.submit_quiz(uuid, int[]) from public, anon;
revoke execute on function public.sell_product(uuid, int, uuid, boolean) from public, anon;
revoke execute on function public.grant_course_access(uuid, uuid, boolean) from public, anon;
revoke execute on function public.request_course(uuid, uuid) from public, anon;
grant execute on function public.assign_quiz(uuid, uuid[]) to authenticated;
grant execute on function public.submit_quiz(uuid, int[]) to authenticated;
grant execute on function public.sell_product(uuid, int, uuid, boolean) to authenticated;
grant execute on function public.grant_course_access(uuid, uuid, boolean) to authenticated;
grant execute on function public.request_course(uuid, uuid) to authenticated;
