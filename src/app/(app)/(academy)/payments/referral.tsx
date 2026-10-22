import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { useAcademy } from '@/features/academies/active-academy';
import { useRegisterReferral } from '@/features/payments/api';
import { useStudents } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { fullName } from '@/lib/format';

/** "Trae a un amigo": el alumno que trajo a otro recibe un descuento en su próxima mensualidad. */
export default function ReferralScreen() {
  const { academy } = useAcademy();
  const { data: students } = useStudents(academy.id);
  const register = useRegisterReferral();
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [referredId, setReferredId] = useState<string | null>(null);
  const [percent, setPercent] = useState('50');
  const [error, setError] = useState<string | null>(null);

  const options = (students ?? [])
    .filter((s) => s.status !== 'inactive')
    .map((s) => ({ value: s.id, label: fullName(s) }));

  function handleSave() {
    if (!referrerId || !referredId) return setError('Elige a ambos alumnos.');
    if (referrerId === referredId) return setError('Deben ser alumnos distintos.');
    setError(null);
    register.mutate(
      { referrerId, referredId, percent: Number(percent) },
      { onSuccess: () => router.back(), onError: (e) => setError(errorMessage(e)) },
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
      <Segmented
        value={percent}
        onChange={setPercent}
        options={[
          { value: '25', label: '25 %' },
          { value: '50', label: '50 %' },
          { value: '100', label: '100 %' },
        ]}
      />
      <FormError message={error} />
      <Button title="Registrar" onPress={handleSave} loading={register.isPending} />
    </Screen>
  );
}
