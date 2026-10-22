// Envía por push (Expo Push API) las notificaciones pendientes de la tabla notifications.
// La invoca cada minuto la tarea pg_cron "send-push" (ver migración scheduled_jobs y README).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
};

type PushTicket = { status: 'ok' | 'error'; details?: { error?: string } };

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // Solo la tarea programada (que usa la llave de servicio) puede ejecutar el envío.
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, data, created_at')
    .is('push_sent_at', null)
    .order('created_at')
    .limit(500);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return Response.json({ sent: 0 });

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, user_id')
    .in('user_id', userIds);

  // No se envían avisos viejos (por ejemplo, si el envío estuvo apagado varios días).
  const fresh = pending.filter((n) => Date.now() - new Date(n.created_at).getTime() < MAX_AGE_MS);
  const messages: PushMessage[] = fresh.flatMap((n) =>
    (tokens ?? [])
      .filter((t) => t.user_id === n.user_id)
      .map((t) => ({
        to: t.token,
        title: n.title,
        body: n.body,
        data: (n.data ?? {}) as Record<string, unknown>,
        sound: 'default' as const,
      })),
  );

  const invalidTokens: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const result = (await response.json().catch(() => null)) as { data?: PushTicket[] } | null;
    result?.data?.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(chunk[index].to);
      }
    });
  }

  if (invalidTokens.length) {
    await supabase.from('push_tokens').delete().in('token', invalidTokens);
  }

  await supabase
    .from('notifications')
    .update({ push_sent_at: new Date().toISOString() })
    .in(
      'id',
      pending.map((n) => n.id),
    );

  return Response.json({ notifications: pending.length, sent: messages.length });
});
