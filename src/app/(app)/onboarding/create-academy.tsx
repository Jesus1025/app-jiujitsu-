import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useCreateAcademy } from '@/features/academies/api';
import { errorMessage } from '@/lib/errors';

export default function CreateAcademyScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createAcademy = useCreateAcademy();

  function handleCreate() {
    if (name.trim().length < 2) {
      setError('Ingresa el nombre de la academia.');
      return;
    }
    setError(null);
    // Al crearla, el layout detecta la academia activa y abre el inicio.
    createAcademy.mutate(name.trim(), { onError: (e) => setError(errorMessage(e)) });
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Quedarás como dueño. Se crean automáticamente las categorías por edad y los cinturones de
        Jiu-Jitsu; podrás ajustarlos después.
      </ThemedText>
      <TextField
        label="Nombre de la academia"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Academia Jiu-Jitsu Santiago"
        autoCapitalize="words"
        onSubmitEditing={handleCreate}
      />
      <FormError message={error} />
      <Button title="Crear academia" onPress={handleCreate} loading={createAcademy.isPending} />
    </Screen>
  );
}
