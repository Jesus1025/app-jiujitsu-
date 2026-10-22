import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { QueryState } from '@/components/ui/states';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useFeePlans, useSaveFeePlan } from '@/features/payments/api';
import { errorMessage } from '@/lib/errors';
import { parseAmount } from '@/lib/format';
import type { Tables } from '@/types/database';

/** Planes de mensualidad (ej. adulto, kids, familiar). Se asignan en la ficha de cada alumno. */
export default function PlansScreen() {
  const { academy, isOwner } = useAcademy();
  const plans = useFeePlans(academy.id);
  const [adding, setAdding] = useState(false);

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Planes y valores' }} />
      <ThemedText type="small" themeColor="textSecondary">
        Cada alumno con plan recibe su mensualidad el día 1 de cada mes (o cuando la generes desde
        Pagos), con vencimiento en el día indicado.
      </ThemedText>
      <QueryState isLoading={plans.isLoading} error={plans.error} onRetry={plans.refetch} />
      {(plans.data ?? []).map((plan) => (
        <PlanEditor key={plan.id} plan={plan} editable={isOwner} />
      ))}
      {isOwner ? (
        adding ? (
          <PlanEditor editable onDone={() => setAdding(false)} />
        ) : (
          <Button title="Agregar plan" variant="secondary" onPress={() => setAdding(true)} />
        )
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Solo el dueño de la academia puede cambiar los valores.
        </ThemedText>
      )}
    </Screen>
  );
}

function PlanEditor({
  plan,
  editable,
  onDone,
}: {
  plan?: Tables<'fee_plans'>;
  editable: boolean;
  onDone?: () => void;
}) {
  const { academy } = useAcademy();
  const save = useSaveFeePlan(academy.id);
  const [name, setName] = useState(plan?.name ?? '');
  const [amount, setAmount] = useState(plan ? String(plan.amount) : '');
  const [billingDay, setBillingDay] = useState(plan ? String(plan.billing_day) : '5');
  const [active, setActive] = useState(plan?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const value = parseAmount(amount);
    const day = Number(billingDay);
    if (!name.trim()) return setError('Ingresa el nombre del plan.');
    if (value === null) return setError('Ingresa el valor.');
    if (!Number.isInteger(day) || day < 1 || day > 28)
      return setError('El día debe estar entre 1 y 28.');
    setError(null);
    save.mutate(
      {
        id: plan?.id,
        academy_id: academy.id,
        name: name.trim(),
        amount: value,
        billing_day: day,
        active,
      },
      {
        onSuccess: () => {
          setSaved(true);
          onDone?.();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <Section title={plan ? plan.name : 'Nuevo plan'}>
      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        editable={editable}
        placeholder="Ej: Mensualidad adulto"
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Valor mensual ($)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            editable={editable}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Vence el día"
            value={billingDay}
            onChangeText={setBillingDay}
            keyboardType="number-pad"
            editable={editable}
          />
        </View>
      </View>
      <SwitchRow label="Plan activo" value={active} onChange={editable ? setActive : () => {}} />
      <FormError message={error} />
      {saved ? <ThemedText type="small">Guardado.</ThemedText> : null}
      {editable ? <Button title="Guardar" onPress={handleSave} loading={save.isPending} /> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
