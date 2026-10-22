import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Enums, TablesInsert, TablesUpdate } from '@/types/database';

export type MemberRole = Enums<'member_role'>;

export const roleLabels: Record<MemberRole, string> = {
  owner: 'Dueño',
  instructor: 'Instructor',
  student: 'Alumno',
  guardian: 'Apoderado',
};

// Columnas visibles de academies (checkin_code está oculto: ver migración hide_checkin_code).
const academyColumns =
  'id, name, join_code, timezone, primary_color, late_tolerance_minutes, public_slug, logo_path, plan, settings';

/** Membresías del usuario actual (pendientes y activas) con los datos de su academia. */
export function useMyMemberships() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  return useQuery({
    queryKey: ['memberships', 'mine', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select(`id, role, status, academy_id, academy:academies (${academyColumns})`)
        .eq('user_id', userId)
        .in('status', ['pending', 'active'])
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export type MyMembership = NonNullable<ReturnType<typeof useMyMemberships>['data']>[number];
export type ActiveAcademyInfo = NonNullable<MyMembership['academy']>;

const roleRank: Record<MemberRole, number> = { owner: 0, instructor: 1, guardian: 2, student: 3 };

/** Membresía activa preferida: la elegida por el usuario o, si no, la de mayor rol. */
export function pickActiveMembership(
  memberships: MyMembership[] | undefined,
  preferredAcademyId?: string | null,
) {
  const active = (memberships ?? []).filter((m) => m.status === 'active' && m.academy);
  const sorted = [...active].sort((a, b) => roleRank[a.role] - roleRank[b.role]);
  return sorted.find((m) => m.academy_id === preferredAcademyId) ?? sorted[0];
}

function useInvalidateMemberships() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['memberships'] });
}

export function useCreateAcademy() {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_academy', { p_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useJoinAcademy() {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: async ({ code, role }: { code: string; role: MemberRole }) => {
      const { data, error } = await supabase.rpc('join_academy', { p_code: code, p_role: role });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Todas las membresías de una academia con el nombre de cada persona (solo staff). */
export function useMembers(academyId: string) {
  return useQuery({
    queryKey: ['memberships', 'academy', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, user_id, role, status, created_at, profile:profiles (full_name, phone)')
        .eq('academy_id', academyId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export type Member = NonNullable<ReturnType<typeof useMembers>['data']>[number];

export function useReviewMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId, approve }: { membershipId: string; approve: boolean }) => {
      const { data, error } = await supabase.rpc('review_membership', {
        p_membership: membershipId,
        p_approve: approve,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSetMembershipStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Enums<'membership_status'> }) => {
      const { error } = await supabase.rpc('set_membership_status', {
        p_membership: id,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberships'] }),
  });
}

export function useUpdateAcademy(academyId: string) {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: async (values: TablesUpdate<'academies'>) => {
      const { error } = await supabase.from('academies').update(values).eq('id', academyId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRegenerateJoinCode(academyId: string) {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regenerate_join_code', { p_academy: academyId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Catálogos: categorías y cinturones
// ---------------------------------------------------------------------------

export function useCategories(academyId: string) {
  return useQuery({
    queryKey: ['categories', academyId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('academy_id', academyId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCategory(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'categories'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('categories').update(rest).eq('id', id)
        : await supabase.from('categories').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', academyId] }),
  });
}

export function useDeleteCategory(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', academyId] }),
  });
}

export function useBelts(academyId: string) {
  return useQuery({
    queryKey: ['belts', academyId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('belts')
        .select('*')
        .eq('academy_id', academyId)
        .order('track')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveBelt(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'belts'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('belts').update(rest).eq('id', id)
        : await supabase.from('belts').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['belts', academyId] }),
  });
}

export function useDeleteBelt(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('belts').delete().eq('id', id);
      if (error) {
        // 23503: hay grados otorgados con este cinturón (la base de datos lo protege).
        if (error.code === '23503') {
          throw new Error('Hay alumnos con este cinturón en su historial; no se puede eliminar.');
        }
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['belts', academyId] }),
  });
}

/** Código del QR de asistencia (solo staff). */
export function useCheckinCode(academyId: string) {
  return useQuery({
    queryKey: ['checkin-code', academyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_checkin_code', { p_academy: academyId });
      if (error) throw error;
      return data;
    },
  });
}

export function useRotateCheckinCode(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rotate_checkin_code', { p_academy: academyId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checkin-code', academyId] }),
  });
}

export function useDashboard(academyId: string) {
  return useQuery({
    queryKey: ['dashboard', academyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('academy_dashboard', { p_academy: academyId });
      if (error) throw error;
      return data as {
        active_students: number;
        pending_students: number;
        pending_requests: number;
        classes_this_month: number;
        attendance_this_month: number;
        income_this_month: number;
        pending_amount: number;
        overdue_students: number;
      };
    },
  });
}
