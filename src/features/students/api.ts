import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { uploadFile } from '@/lib/files';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type Student = Tables<'students'>;
export type StudentProgress = Tables<'student_progress'>;
export type StudentBalance = Tables<'student_balances'>;

function useInvalidateStudents() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

/** Fichas visibles de la academia (todas para el staff; las propias para alumnos/apoderados). */
export function useStudents(academyId: string) {
  return useQuery({
    queryKey: ['students', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('academy_id', academyId)
        .order('last_name')
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });
}

/** Fichas del usuario actual: la propia y las de sus hijos. */
export function useMyStudents(academyId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  return useQuery({
    queryKey: ['students', academyId ?? 'all', 'mine', userId],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('*')
        .or(`user_id.eq.${userId},guardian_user_id.eq.${userId}`)
        .order('first_name');
      if (academyId) query = query.eq('academy_id', academyId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useStudent(id: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ['students', 'one', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useStudentProgressList(academyId: string) {
  return useQuery({
    queryKey: ['students', academyId, 'progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_progress')
        .select('*')
        .eq('academy_id', academyId);
      if (error) throw error;
      return new Map(data.map((row) => [row.student_id ?? '', row]));
    },
  });
}

export function useStudentBalances(academyId: string) {
  return useQuery({
    queryKey: ['students', academyId, 'balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_balances')
        .select('*')
        .eq('academy_id', academyId);
      if (error) throw error;
      return new Map(data.map((row) => [row.student_id ?? '', row]));
    },
  });
}

export function useCreateStudent() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: async (values: TablesInsert<'students'>) => {
      const { data, error } = await supabase.from('students').insert(values).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateStudent() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'students'> }) => {
      const { error } = await supabase.from('students').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteStudent() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Sube la foto de la ficha y guarda su ruta. */
export function useUploadStudentPhoto() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: async ({ student, uri }: { student: Student; uri: string }) => {
      const path = `${student.academy_id}/students/${student.id}/photo-${Date.now()}.jpg`;
      await uploadFile(path, uri, 'image/jpeg');
      const { error } = await supabase
        .from('students')
        .update({ photo_path: path })
        .eq('id', student.id);
      if (error) throw error;
      return path;
    },
    onSuccess: invalidate,
  });
}

export function useLinkStudentAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, userId }: { studentId: string; userId: string }) => {
      const { error } = await supabase.rpc('link_student_account', {
        p_student: studentId,
        p_user: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Grados
// ---------------------------------------------------------------------------

export function useRankAwards(studentId: string) {
  return useQuery({
    queryKey: ['students', 'ranks', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rank_awards')
        .select('*')
        .eq('student_id', studentId)
        .order('awarded_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAwardRank() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: async (values: TablesInsert<'rank_awards'>) => {
      const { error } = await supabase.from('rank_awards').insert(values);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRankAward() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rank_awards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Exoneración
// ---------------------------------------------------------------------------

export function useActiveWaiver(academyId: string) {
  return useQuery({
    queryKey: ['waiver', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiver_templates')
        .select('*')
        .eq('academy_id', academyId)
        .eq('active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWaiverSignatures(studentId: string) {
  return useQuery({
    queryKey: ['students', 'waivers', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiver_signatures')
        .select('*')
        .eq('student_id', studentId)
        .order('signed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Ids de las fichas (entre las indicadas) que ya firmaron alguna exoneración. */
export function useSignedStudentIds(studentIds: string[]) {
  return useQuery({
    queryKey: ['students', 'signed', ...studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiver_signatures')
        .select('student_id')
        .in('student_id', studentIds);
      if (error) throw error;
      return new Set(data.map((row) => row.student_id));
    },
  });
}

export function useSignWaiver() {
  const invalidate = useInvalidateStudents();
  return useMutation({
    mutationFn: async (values: TablesInsert<'waiver_signatures'>) => {
      const { error } = await supabase.from('waiver_signatures').insert(values);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Asistencia de un alumno
// ---------------------------------------------------------------------------

export function useStudentAttendance(studentId: string, limit = 30) {
  return useQuery({
    queryKey: ['students', 'attendance', studentId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, is_late, method, checked_in_at, session:class_sessions (date, title)')
        .eq('student_id', studentId)
        .order('checked_in_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}
