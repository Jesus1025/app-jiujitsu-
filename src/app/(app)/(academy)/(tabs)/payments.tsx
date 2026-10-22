import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { Stat, StatGrid } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useDashboard } from '@/features/academies/api';
import {
  conceptLabels,
  methodLabels,
  periodOf,
  useCharges,
  useGenerateMonthlyCharges,
  usePayments,
} from '@/features/payments/api';
import { useMyStudents, useStudentBalances, useStudents } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatMoney, formatPeriod, fullName, todayIn } from '@/lib/format';

export default function PaymentsScreen() {
  const { isStaff } = useAcademy();
  return isStaff ? <StaffPayments /> : <MemberPayments />;
}

type PaymentsView = 'overdue' | 'pending' | 'recent';

function StaffPayments() {
  const { academy } = useAcademy();
  const today = todayIn(academy.timezone);
  const [view, setView] = useState<PaymentsView>('overdue');
  const students = useStudents(academy.id);
  const balances = useStudentBalances(academy.id);
  const pending = useCharges({ academyId: academy.id, status: 'pending' });
  const recent = usePayments({ academyId: academy.id, limit: 50 });
  const generate = useGenerateMonthlyCharges(academy.id);
  const dashboard = useDashboard(academy.id);

  const studentName = (id: string | null) => {
    const s = students.data?.find((x) => x.id === id);
    return s ? fullName(s) : 'Alumno';
  };

  const debtors = (students.data ?? [])
    .map((s) => ({ student: s, balance: balances.data?.get(s.id) }))
    .filter((x) => (x.balance?.pending_amount ?? 0) > 0)
    .sort((a, b) => (b.balance?.pending_amount ?? 0) - (a.balance?.pending_amount ?? 0));
  const overdue = debtors.filter((x) => (x.balance?.overdue_months ?? 0) > 0);
  const totalPending = debtors.reduce((sum, x) => sum + (x.balance?.pending_amount ?? 0), 0);
  const monthIncome = dashboard.data?.income_this_month ?? 0;

  function confirmGenerate(period: string) {
    Alert.alert(
      `Generar mensualidades de ${formatPeriod(period)}`,
      'Se crea el cobro a cada alumno activo con plan de pago (si ya existe, no se duplica). Los descuentos pendientes se aplican solos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: () =>
            generate.mutate(period, {
              onSuccess: (count) =>
                Alert.alert(
                  'Listo',
                  count
                    ? `Se generaron ${count} mensualidades.`
                    : 'No había mensualidades nuevas por generar.',
                ),
              onError: (e) => Alert.alert('No se pudo generar', errorMessage(e)),
            }),
        },
      ],
    );
  }

  return (
    <Screen
      safeArea="none"
      refreshing={pending.isRefetching}
      onRefresh={() => {
        balances.refetch();
        pending.refetch();
        recent.refetch();
      }}>
      <StatGrid>
        <Stat label="Por cobrar" value={formatMoney(totalPending)} />
        <Stat label="Cobrado este mes" value={formatMoney(monthIncome)} />
      </StatGrid>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Registrar cobro" onPress={() => router.push('/payments/new-charge')} />
        </View>
        <View style={styles.action}>
          <Button
            title={`Mensualidades ${formatPeriod(periodOf(today)).split(' ')[0]}`}
            variant="secondary"
            onPress={() => confirmGenerate(periodOf(today))}
            loading={generate.isPending}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title="Planes y valores"
            variant="ghost"
            onPress={() => router.push('/payments/plans')}
          />
        </View>
        <View style={styles.action}>
          <Button
            title="Registrar referido"
            variant="ghost"
            onPress={() => router.push('/payments/referral')}
          />
        </View>
      </View>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'overdue', label: `Atrasados (${overdue.length})` },
          { value: 'pending', label: 'Pendientes' },
          { value: 'recent', label: 'Pagos' },
        ]}
      />

      {view === 'overdue' ? (
        <View>
          {overdue.length ? (
            overdue.map(({ student, balance }) => (
              <ListItem
                key={student.id}
                title={fullName(student)}
                subtitle={`${balance?.overdue_months} mensualidad(es) atrasada(s) · desde ${formatDate(balance?.oldest_due_date)}`}
                left={<Avatar name={fullName(student)} photoPath={student.photo_path} />}
                right={<Badge label={formatMoney(balance?.pending_amount)} tone="danger" />}
                onPress={() => router.push(`/students/${student.id}`)}
              />
            ))
          ) : (
            <EmptyState message="Nadie tiene mensualidades atrasadas. 🎉" />
          )}
        </View>
      ) : null}

      {view === 'pending' ? (
        <View>
          {(pending.data ?? []).length ? (
            (pending.data ?? []).map((charge) => (
              <ListItem
                key={charge.id}
                title={studentName(charge.student_id)}
                subtitle={`${charge.description || conceptLabels[charge.concept ?? 'other']} · vence ${formatDate(charge.due_date)}`}
                right={
                  <Badge
                    label={formatMoney(charge.remaining)}
                    tone={(charge.due_date ?? '') < today ? 'danger' : 'warning'}
                  />
                }
                onPress={() => router.push(`/payments/charge/${charge.id}`)}
              />
            ))
          ) : (
            <EmptyState message="No hay cobros pendientes." />
          )}
        </View>
      ) : null}

      {view === 'recent' ? (
        <View>
          {(recent.data ?? []).length ? (
            (recent.data ?? []).map((payment) => (
              <ListItem
                key={payment.id}
                title={studentName(payment.student_id)}
                subtitle={`${formatDate(payment.paid_at)} · ${methodLabels[payment.method] ?? payment.method}`}
                right={formatMoney(payment.amount)}
                onPress={() => router.push(`/payments/charge/${payment.charge_id}`)}
              />
            ))
          ) : (
            <EmptyState message="Aún no hay pagos registrados." />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function MemberPayments() {
  const { academy } = useAcademy();
  const today = todayIn(academy.timezone);
  const myStudents = useMyStudents(academy.id);
  const students = myStudents.data ?? [];

  return (
    <Screen safeArea="none" refreshing={myStudents.isRefetching} onRefresh={myStudents.refetch}>
      {students.map((student) => (
        <StudentCharges
          key={student.id}
          studentId={student.id}
          name={fullName(student)}
          today={today}
        />
      ))}
      {!students.length && !myStudents.isLoading ? (
        <EmptyState message="Aún no tienes una ficha en esta academia." />
      ) : null}
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Los pagos se registran en la academia (efectivo o transferencia). Si ya pagaste y aquí
          aparece pendiente, avísale a tu profesor.
        </ThemedText>
      </Card>
    </Screen>
  );
}

function StudentCharges({
  studentId,
  name,
  today,
}: {
  studentId: string;
  name: string;
  today: string;
}) {
  const { data: charges } = useCharges({ studentId });
  const pending = (charges ?? []).filter((c) => c.status === 'pending');
  const paid = (charges ?? []).filter((c) => c.status === 'paid').slice(0, 6);
  const total = pending.reduce((sum, c) => sum + (c.remaining ?? 0), 0);

  return (
    <Section title={total ? `${name} · debe ${formatMoney(total)}` : `${name} · al día`}>
      {pending.map((charge) => (
        <ListItem
          key={charge.id}
          title={charge.description || conceptLabels[charge.concept ?? 'other']}
          subtitle={`Vence el ${formatDate(charge.due_date)}`}
          right={
            <Badge
              label={formatMoney(charge.remaining)}
              tone={(charge.due_date ?? '') < today ? 'danger' : 'warning'}
            />
          }
          onPress={() => router.push(`/payments/charge/${charge.id}`)}
        />
      ))}
      {paid.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          Pagos recientes
        </ThemedText>
      ) : null}
      {paid.map((charge) => (
        <ListItem
          key={charge.id}
          title={charge.description || conceptLabels[charge.concept ?? 'other']}
          subtitle={formatDate(charge.due_date)}
          right={<Badge label="Pagado" tone="success" />}
          onPress={() => router.push(`/payments/charge/${charge.id}`)}
        />
      ))}
      {charges && !charges.length ? <EmptyState message="Sin cobros por ahora." /> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
