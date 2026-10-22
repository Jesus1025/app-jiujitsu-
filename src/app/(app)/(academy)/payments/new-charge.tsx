import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import { conceptLabels, periodOf, useCreateCharge } from '@/features/payments/api';
import { useStudents } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { fullName, parseAmount, todayIn } from '@/lib/format';

type Concept = 'enrollment' | 'monthly' | 'event' | 'product' | 'course' | 'other';

/** Cobro manual: matrícula, mensualidad suelta, seminario, producto, etc. */
export default function NewChargeScreen() {
  const params = useLocalSearchParams<{ student?: string }>();
  const { academy } = useAcademy();
  const { data: students } = useStudents(academy.id);
  const create = useCreateCharge();
  const today = todayIn(academy.timezone);
  const [studentId, setStudentId] = useState<string | null>(params.student ?? null);
  const [concept, setConcept] = useState<Concept | null>('enrollment');
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(today);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const amount = parseAmount(amountText);
    if (!studentId) return setError('Elige al alumno.');
    if (!concept) return setError('Elige el concepto.');
    if (amount === null) return setError('Ingresa el monto.');
    if (!dueDate) return setError('Ingresa la fecha de vencimiento.');
    setError(null);
    create.mutate(
      {
        academy_id: academy.id,
        student_id: studentId,
        concept,
        period: concept === 'monthly' ? periodOf(dueDate) : null,
        description: description.trim() || conceptLabels[concept],
        amount,
        due_date: dueDate,
      },
      { onSuccess: () => router.back(), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Nuevo cobro' }} />
      <Select
        label="Alumno"
        value={studentId}
        onChange={setStudentId}
        searchable
        options={(students ?? [])
          .filter((s) => s.status !== 'inactive')
          .map((s) => ({ value: s.id, label: fullName(s) }))}
      />
      <Select
        label="Concepto"
        value={concept}
        onChange={setConcept}
        options={(Object.keys(conceptLabels) as Concept[]).map((key) => ({
          value: key,
          label: conceptLabels[key],
        }))}
      />
      <TextField
        label="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        placeholder="Ej: Matrícula 2026"
      />
      <TextField
        label="Monto"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="number-pad"
        placeholder="Ej: 30000"
      />
      <DateField label="Vence el" value={dueDate} onChange={setDueDate} />
      <FormError message={error} />
      <Button title="Crear cobro" onPress={handleSave} loading={create.isPending} />
    </Screen>
  );
}
