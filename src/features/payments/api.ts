import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type ChargeBalance = Tables<'charge_balances'>;

export const conceptLabels: Record<string, string> = {
  enrollment: 'Matrícula',
  monthly: 'Mensualidad',
  event: 'Evento',
  product: 'Producto',
  course: 'Curso',
  other: 'Otro',
};

export const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  gateway: 'Pago en línea',
  other: 'Otro',
};

function useInvalidatePayments() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['charges'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useFeePlans(academyId: string) {
  return useQuery({
    queryKey: ['fee-plans', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('academy_id', academyId)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveFeePlan(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'fee_plans'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('fee_plans').update(rest).eq('id', id)
        : await supabase.from('fee_plans').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fee-plans', academyId] }),
  });
}

/** Cobros con su saldo. Filtra por academia, alumno y/o estado. */
export function useCharges(filter: {
  academyId?: string;
  studentId?: string;
  status?: 'pending' | 'paid' | 'void';
  limit?: number;
}) {
  return useQuery({
    queryKey: ['charges', filter],
    queryFn: async () => {
      let query = supabase.from('charge_balances').select('*');
      if (filter.academyId) query = query.eq('academy_id', filter.academyId);
      if (filter.studentId) query = query.eq('student_id', filter.studentId);
      if (filter.status) query = query.eq('status', filter.status);
      const { data, error } = await query
        .order('due_date', { ascending: filter.status === 'pending' })
        .limit(filter.limit ?? 200);
      if (error) throw error;
      return data;
    },
  });
}

export function useCharge(id: string) {
  return useQuery({
    queryKey: ['charges', 'one', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_balances')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCharge() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async (values: TablesInsert<'charges'>) => {
      const { error } = await supabase.from('charges').insert(values);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCharge() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'charges'> }) => {
      const { error } = await supabase.from('charges').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function usePayments(filter: {
  academyId?: string;
  chargeId?: string;
  studentId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['payments', filter],
    queryFn: async () => {
      let query = supabase.from('payments').select('*');
      if (filter.academyId) query = query.eq('academy_id', filter.academyId);
      if (filter.chargeId) query = query.eq('charge_id', filter.chargeId);
      if (filter.studentId) query = query.eq('student_id', filter.studentId);
      const { data, error } = await query
        .order('paid_at', { ascending: false })
        .limit(filter.limit ?? 100);
      if (error) throw error;
      return data;
    },
  });
}

export function useRecordPayment() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async (values: TablesInsert<'payments'>) => {
      const { error } = await supabase.from('payments').insert(values);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeletePayment() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useGenerateMonthlyCharges(academyId: string) {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async (period: string) => {
      const { data, error } = await supabase.rpc('generate_monthly_charges', {
        p_academy: academyId,
        p_period: period,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRegisterReferral() {
  const invalidate = useInvalidatePayments();
  return useMutation({
    mutationFn: async (args: { referrerId: string; referredId: string; percent: number }) => {
      const { error } = await supabase.rpc('register_referral', {
        p_referrer: args.referrerId,
        p_referred: args.referredId,
        p_percent: args.percent,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDiscounts(studentId: string) {
  return useQuery({
    queryKey: ['charges', 'discounts', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** 'AAAA-MM' del mes de una fecha 'AAAA-MM-DD', desplazado n meses. */
export function periodOf(isoDate: string, offsetMonths = 0) {
  const [y, m] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  return date.toISOString().slice(0, 7);
}
