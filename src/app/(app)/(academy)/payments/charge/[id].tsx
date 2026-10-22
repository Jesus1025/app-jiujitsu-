import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import {
  conceptLabels,
  methodLabels,
  useCharge,
  useDeletePayment,
  usePayments,
  useRecordPayment,
  useUpdateCharge,
} from '@/features/payments/api';
import { useStudent } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatMoney, formatPeriod, fullName, parseAmount } from '@/lib/format';

type Method = 'cash' | 'transfer' | 'card' | 'other';

export default function ChargeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy, isStaff } = useAcademy();
  const charge = useCharge(id);
  const { data: payments } = usePayments({ chargeId: id });
  const { data: student } = useStudent(charge.data?.student_id ?? '');
  const record = useRecordPayment();
  const removePayment = useDeletePayment();
  const updateCharge = useUpdateCharge();
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<Method>('transfer');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!charge.data) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={charge.isLoading} error={charge.error} onRetry={charge.refetch} />
      </Screen>
    );
  }

  const c = charge.data;
  const remaining = c.remaining ?? 0;

  function handleRecord() {
    const amount = amountText ? parseAmount(amountText) : remaining;
    if (!amount || amount <= 0) return setError('Ingresa un monto válido.');
    setError(null);
    record.mutate(
      {
        academy_id: academy.id,
        charge_id: c.id!,
        student_id: c.student_id!,
        amount,
        method,
        reference: reference.trim() || null,
      },
      {
        onSuccess: () => {
          setAmountText('');
          setReference('');
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  function confirmVoid() {
    Alert.alert('Anular cobro', 'El cobro deja de contar como deuda. Se puede revertir.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: () => updateCharge.mutate({ id: c.id!, values: { status: 'void' } }),
      },
    ]);
  }

  return (
    <Screen safeArea="bottom" refreshing={charge.isRefetching} onRefresh={charge.refetch}>
      <Stack.Screen options={{ title: 'Cobro' }} />
      <Card>
        <ThemedText type="smallBold">
          {c.description || conceptLabels[c.concept ?? 'other']}
        </ThemedText>
        {student ? (
          <ListItem
            title={fullName(student)}
            onPress={isStaff ? () => router.push(`/students/${student.id}`) : undefined}
          />
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {conceptLabels[c.concept ?? 'other']}
          {c.period ? ` · ${formatPeriod(c.period)}` : ''} · vence el {formatDate(c.due_date)}
        </ThemedText>
        <View style={styles.amounts}>
          <ThemedText>Valor: {formatMoney(c.amount)}</ThemedText>
          {c.discount ? <ThemedText>Descuento: −{formatMoney(c.discount)}</ThemedText> : null}
          <ThemedText>Pagado: {formatMoney(c.paid_amount)}</ThemedText>
          <ThemedText type="subtitle">Saldo: {formatMoney(remaining)}</ThemedText>
        </View>
        <Badge
          label={c.status === 'paid' ? 'Pagado' : c.status === 'void' ? 'Anulado' : 'Pendiente'}
          tone={c.status === 'paid' ? 'success' : c.status === 'void' ? 'neutral' : 'warning'}
        />
      </Card>

      {isStaff && c.status === 'pending' ? (
        <Section title="Registrar pago">
          <TextField
            label="Monto"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            placeholder={`${remaining} (saldo completo)`}
          />
          <Segmented
            value={method}
            onChange={setMethod}
            options={[
              { value: 'transfer', label: 'Transferencia' },
              { value: 'cash', label: 'Efectivo' },
              { value: 'card', label: 'Tarjeta' },
            ]}
          />
          <TextField
            label="Referencia (opcional)"
            value={reference}
            onChangeText={setReference}
            placeholder="N° de transferencia, comentario…"
          />
          <FormError message={error} />
          <Button title="Registrar pago" onPress={handleRecord} loading={record.isPending} />
        </Section>
      ) : null}

      <Section title="Pagos">
        {payments?.length ? (
          payments.map((payment) => (
            <ListItem
              key={payment.id}
              title={formatMoney(payment.amount)}
              subtitle={`${formatDate(payment.paid_at)} · ${methodLabels[payment.method] ?? payment.method}${
                payment.reference ? ` · ${payment.reference}` : ''
              }`}
              right={
                isStaff ? (
                  <Button
                    title="Quitar"
                    variant="ghost"
                    onPress={() =>
                      Alert.alert(
                        'Quitar pago',
                        '¿Eliminar este pago? El saldo vuelve a quedar pendiente.',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Quitar',
                            style: 'destructive',
                            onPress: () => removePayment.mutate(payment.id),
                          },
                        ],
                      )
                    }
                  />
                ) : undefined
              }
            />
          ))
        ) : (
          <EmptyState message="Sin pagos registrados." />
        )}
      </Section>

      {isStaff && c.status === 'pending' ? (
        <Button title="Anular cobro" variant="ghost" onPress={confirmVoid} />
      ) : null}
      {isStaff && c.status === 'void' ? (
        <Button
          title="Reactivar cobro"
          variant="ghost"
          onPress={() => updateCharge.mutate({ id: c.id!, values: { status: 'pending' } })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  amounts: { gap: Spacing.half },
});
