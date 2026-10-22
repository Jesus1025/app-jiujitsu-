import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Alert } from '@/lib/alert';
import { BeltBadge } from '@/components/belt-badge';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts, useRegenerateJoinCode, useUpdateAcademy } from '@/features/academies/api';
import { errorMessage } from '@/lib/errors';

/** Ajustes de la academia (solo el dueño). */
export default function SettingsScreen() {
  const { academy } = useAcademy();
  const update = useUpdateAcademy(academy.id);
  const regenerate = useRegenerateJoinCode(academy.id);
  const { data: belts } = useBelts(academy.id);
  const [name, setName] = useState(academy.name);
  const [tolerance, setTolerance] = useState(String(academy.late_tolerance_minutes));
  const [slug, setSlug] = useState(academy.public_slug ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const minutes = Number(tolerance);
    const cleanSlug = slug.trim().toLowerCase();
    if (name.trim().length < 2) return setError('Ingresa el nombre.');
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) {
      return setError('La tolerancia debe estar entre 0 y 120 minutos.');
    }
    if (cleanSlug && !/^[a-z0-9-]{3,50}$/.test(cleanSlug)) {
      return setError('El nombre web solo puede tener minúsculas, números y guiones (3 a 50).');
    }
    setError(null);
    setSaved(false);
    update.mutate(
      { name: name.trim(), late_tolerance_minutes: minutes, public_slug: cleanSlug || null },
      {
        onSuccess: () => setSaved(true),
        onError: (e) =>
          setError(
            (e as { code?: string }).code === '23505'
              ? 'Ese nombre web ya lo usa otra academia.'
              : errorMessage(e),
          ),
      },
    );
  }

  function confirmRegenerate() {
    Alert.alert(
      'Cambiar código de invitación',
      'El código actual dejará de servir para unirse. Quienes ya son miembros no se ven afectados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cambiar', onPress: () => regenerate.mutate() },
      ],
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Ajustes de la academia' }} />
      <Section title="General">
        <TextField label="Nombre de la academia" value={name} onChangeText={setName} />
        <TextField
          label="Tolerancia para atraso (minutos)"
          value={tolerance}
          onChangeText={setTolerance}
          keyboardType="number-pad"
        />
        <TextField
          label="Nombre web (para mostrar noticias en la página)"
          value={slug}
          onChangeText={setSlug}
          autoCapitalize="none"
          placeholder="ej: academia-jiujitsu-santiago"
        />
        <FormError message={error} />
        {saved ? <ThemedText type="small">Guardado.</ThemedText> : null}
        <Button title="Guardar" onPress={handleSave} loading={update.isPending} />
      </Section>

      <Section title="Código de invitación">
        <ThemedText type="subtitle">{academy.join_code}</ThemedText>
        <Button
          title="Cambiar código"
          variant="secondary"
          onPress={confirmRegenerate}
          loading={regenerate.isPending}
        />
      </Section>

      <Section title="Más ajustes">
        <ListItem title="Categorías por edad" onPress={() => router.push('/settings/categories')} />
        <ListItem title="Texto de la exoneración" onPress={() => router.push('/settings/waiver')} />
        <ListItem title="Planes y valores" onPress={() => router.push('/payments/plans')} />
        <ListItem
          title="Requisitos de graduación"
          onPress={() => router.push('/graduation/requirements')}
        />
        <ListItem title="Horario de clases" onPress={() => router.push('/classes/schedule')} />
      </Section>

      <Section title="Cinturones">
        {(belts ?? []).map((belt) => (
          <BeltBadge key={belt.id} belt={belt} degree={0} width={100} />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Sistema IBJJF: adulto desde los 16 años, kids hasta los 15.
        </ThemedText>
      </Section>
    </Screen>
  );
}
