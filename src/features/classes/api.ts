import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/types/database';

export type ClassSchedule = Tables<'class_schedules'>;

export function useSchedules(academyId: string) {
  return useQuery({
    queryKey: ['schedules', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('academy_id', academyId)
        .order('weekday')
        .order('start_time');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveSchedule(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'class_schedules'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('class_schedules').update(rest).eq('id', id)
        : await supabase.from('class_schedules').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules', academyId] }),
  });
}

export function useDeleteSchedule(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('class_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules', academyId] }),
  });
}

/** Sesiones de un día (para saber cuáles ya existen y cuántos asistentes tienen). */
export function useSessionsOn(academyId: string, date: string) {
  return useQuery({
    queryKey: ['sessions', academyId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('academy_id', academyId)
        .eq('date', date);
      if (error) throw error;
      return data;
    },
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', 'one', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useEnsureSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scheduleId, date }: { scheduleId: string; date: string }) => {
      const { data, error } = await supabase.rpc('ensure_class_session', {
        p_schedule: scheduleId,
        p_date: date,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: string; notes?: string }) => {
      const { error } = await supabase
        .from('class_sessions')
        .update({ status, notes })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useSessionAttendance(sessionId: string) {
  return useQuery({
    queryKey: ['attendance', 'session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', sessionId);
      if (error) throw error;
      return new Map(data.map((row) => [row.student_id, row]));
    },
  });
}

/** Conteo de asistentes por sesión (para la lista de clases del día). */
export function useAttendanceCounts(sessionIds: string[]) {
  return useQuery({
    queryKey: ['attendance', 'counts', ...sessionIds],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('session_id')
        .in('session_id', sessionIds);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data) counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
      return counts;
    },
  });
}

function useInvalidateAttendance() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };
}

export function useSetAttendance() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: async ({
      academyId,
      sessionId,
      studentId,
      present,
      isLate = false,
    }: {
      academyId: string;
      sessionId: string;
      studentId: string;
      present: boolean;
      isLate?: boolean;
    }) => {
      const { error } = present
        ? await supabase.from('attendance').upsert(
            {
              academy_id: academyId,
              session_id: sessionId,
              student_id: studentId,
              is_late: isLate,
              method: 'manual',
            },
            { onConflict: 'session_id,student_id' },
          )
        : await supabase
            .from('attendance')
            .delete()
            .eq('session_id', sessionId)
            .eq('student_id', studentId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCheckIn() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: async (args: {
      academyId: string;
      code: string;
      studentId?: string;
      method?: 'qr' | 'nfc';
    }) => {
      const { data, error } = await supabase.rpc('check_in', {
        p_academy: args.academyId,
        p_code: args.code,
        p_student: args.studentId,
        p_method: args.method ?? 'qr',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Enlace que va en el QR y en el sticker NFC; abre la app en la pantalla de asistencia. */
export function checkinLink(academyId: string, code: string, method: 'qr' | 'nfc' = 'qr') {
  return `appjiujitsu://checkin?academy=${academyId}&code=${code}&method=${method}`;
}

/** Extrae academia y código de un enlace de asistencia escaneado. */
export function parseCheckinLink(text: string) {
  const match = text.match(/checkin\?(.+)$/);
  if (!match) return null;
  const params = new URLSearchParams(match[1]);
  const academy = params.get('academy');
  const code = params.get('code');
  if (!academy || !code) return null;
  return { academy, code, method: params.get('method') === 'nfc' ? 'nfc' : 'qr' } as const;
}

export function useRanking(academyId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['ranking', academyId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('attendance_ranking', {
        p_academy: academyId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return data;
    },
  });
}
