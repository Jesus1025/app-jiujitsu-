-- Tareas programadas (pg_cron) y envío de notificaciones push (Edge Function send-push vía pg_net).

-- Tareas diarias: mensualidades (día 1 de cada mes), recordatorios de pago, cumpleaños,
-- resumen de morosos (lunes) y pruebas automáticas.
create function public.run_daily_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_academy record;
  v_charges int := 0;
begin
  for v_academy in
    select id from public.academies
    where extract(day from now() at time zone timezone) = 1
  loop
    v_charges := v_charges + public.generate_monthly_charges(v_academy.id, null);
  end loop;

  return jsonb_build_object(
    'monthly_charges', v_charges,
    'payment_reminders', public.queue_payment_reminders(),
    'staff_reminders', public.queue_staff_reminders(),
    'quizzes', public.auto_assign_quizzes()
  );
end;
$$;

-- Llama a la Edge Function que envía las notificaciones pendientes por push.
-- Requiere dos secretos en Vault (ver README): project_url y service_role_key.
create function public.invoke_push_sender()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  if not exists (select 1 from public.notifications where push_sent_at is null) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.run_daily_jobs() from public, anon, authenticated;
revoke execute on function public.invoke_push_sender() from public, anon, authenticated;

-- Programación (solo si las extensiones existen: en Supabase sí; en otros Postgres se omite).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- 13:00 UTC = 10:00 en Chile (horario de verano: 10:00/11:00).
    perform cron.schedule('daily-jobs', '0 13 * * *', 'select public.run_daily_jobs()');
    perform cron.schedule('weekly-event-reminders', '0 14 * * 1', 'select public.queue_event_reminders()');

    if exists (select 1 from pg_available_extensions where name = 'pg_net') then
      create extension if not exists pg_net;
      perform cron.schedule('send-push', '* * * * *', 'select public.invoke_push_sender()');
    end if;
  end if;
end;
$$;
