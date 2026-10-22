import { Stack } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/lib/navigation';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import { useRegisterReferral } from '@/features/payments/api';
import { useStudents } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { fullName } from '@/lib/format';

/** "Trae a un amigo": el alumno que trajo a otro recibe un descuento en su próxima mensualidad. */
export default function ReferralScreen() {
  const { academy, settings } = useAcademy();
  const { data: students } = useStudents(academy.id);
  const register = useRegisterReferral();
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [referredId, setReferredId] = useState<string | null>(null);
  const [percent, setPercent] = useState(String(settings.referral_percent));
  const [error, setError] = useState<string | null>(null);

  const options = (students ?? [])
    .filter((s) => s.status !== 'inactive')
    .map((s) => ({ value: s.id, label: fullName(s) }));

  function handleSave() {
    if (!referrerId || !referredId) return setError('Elige a ambos alumnos.');
    if (referrerId === referredId) return setError('Deben ser alumnos distintos.');
    const value = Number(percent);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      return setError('El descuento debe estar entre 1 y 100 %.');
    }
    setError(null);
    register.mutate(
      { referrerId, referredId, percent: value },
      { onSuccess: () => goBack(), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Registrar referido' }} />
      <ThemedText themeColor="textSecondary">
        El descuento se aplica solo en la próxima mensualidad que se genere para el alumno que trajo
        al nuevo. Conviene registrarlo cuando el nuevo alumno pague su matrícula.
      </ThemedText>
      <Select
        label="Alumno que trajo a alguien"
        value={referrerId}
        onChange={setReferrerId}
        options={options}
        searchable
      />
      <Select
        label="Alumno nuevo"
        value={referredId}
        onChange={setReferredId}
        options={options}
        searchable
      />
      <TextField
        label="Descuento para quien trajo al alumno (%)"
        value={percent}
        onChangeText={setPercent}
        keyboardType="number-pad"
      />
      <FormError message={error} />
      <Button title="Registrar" onPress={handleSave} loading={register.isPending} />
    </Screen>
  );
}
