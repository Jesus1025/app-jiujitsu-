import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Enums } from '@/types/database';

export type MemberRole = Enums<'member_role'>;

export const roleLabels: Record<MemberRole, string> = {
  owner: 'Dueño',
  instructor: 'Instructor',
  student: 'Alumno',
  guardian: 'Apoderado',
};

const keys = {
  myMemberships: (userId: string) => ['memberships', 'mine', userId] as const,
  pending: (academyId: string) => ['memberships', 'pending', academyId] as const,
};

/** Membresías del usuario actual (pendientes y activas) con los datos de su academia. */
export function useMyMemberships() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  return useQuery({
    queryKey: keys.myMemberships(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, role, status, academy:academies (id, name, join_code)')
        .eq('user_id', userId)
        .in('status', ['pending', 'active'])
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export type MyMembership = NonNullable<ReturnType<typeof useMyMemberships>['data']>[number];

/** Academia en la que el usuario trabaja ahora: la primera activa, priorizando las que administra. */
export function pickActiveMembership(memberships: MyMembership[] | undefined) {
  const active = (memberships ?? []).filter((m) => m.status === 'active');
  const rank: Record<MemberRole, number> = { owner: 0, instructor: 1, guardian: 2, student: 3 };
  return active.sort((a, b) => rank[a.role] - rank[b.role])[0];
}

export function useCreateAcademy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_academy', { p_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberships', 'mine'] }),
  });
}

export function useJoinAcademy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, role }: { code: string; role: MemberRole }) => {
      const { data, error } = await supabase.rpc('join_academy', { p_code: code, p_role: role });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberships', 'mine'] }),
  });
}

/** Solicitudes pendientes de una academia (solo visibles para dueño e instructores). */
export function usePendingRequests(academyId: string | undefined) {
  return useQuery({
    queryKey: keys.pending(academyId ?? ''),
    enabled: !!academyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, role, created_at, profile:profiles (full_name)')
        .eq('academy_id', academyId!)
        .eq('status', 'pending')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useReviewMembership(academyId: string) {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.pending(academyId) }),
  });
}
