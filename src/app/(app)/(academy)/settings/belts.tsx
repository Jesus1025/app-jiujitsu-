import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BeltBadge } from '@/components/belt-badge';
import { ColorPicker } from '@/components/color-picker';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts, useDeleteBelt, useSaveBelt } from '@/features/academies/api';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import type { Tables } from '@/types/database';

type Belt = Tables<'belts'>;

/** Sistema de cinturones de la academia: viene con IBJJF y cada academia lo adapta. */
export default function BeltsScreen() {
  const { academy, settings } = useAcademy();
  const { data: belts } = useBelts(academy.id);
  const [track, setTrack] = useState<'adult' | 'kids'>('adult');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const trackBelts = (belts ?? [])
    .filter((b) => b.track === track)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Cinturones y grados' }} />
      <ThemedText type="small" themeColor="textSecondary">
        El orden de la lista es el orden de progresión. Los alumnos menores de{' '}
        {settings.adult_belt_age} años usan el sistema kids (se cambia en Reglas de la academia).
      </ThemedText>
      <Segmented
        value={track}
        onChange={(value) => {
          setTrack(value);
          setEditing(null);
        }}
        options={[
          { value: 'adult', label: 'Adulto' },
          { value: 'kids', label: 'Kids' },
        ]}
      />

      {trackBelts.map((belt) =>
        editing === belt.id ? (
          <BeltEditor key={belt.id} belt={belt} track={track} onDone={() => setEditing(null)} />
        ) : (
          <ListItem
            key={belt.id}
            title={belt.name}
            subtitle={`Hasta ${belt.max_degrees} grados`}
            left={<BeltBadge belt={belt} degree={0} showLabel={false} width={72} />}
            onPress={() => setEditing(belt.id)}
          />
        ),
      )}

      {editing === 'new' ? (
        <BeltEditor
          track={track}
          nextOrder={(trackBelts.at(-1)?.sort_order ?? 0) + 1}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button
          title="Agregar cinturón al final"
          variant="secondary"
          onPress={() => setEditing('new')}
        />
      )}
    </Screen>
  );
}

function BeltEditor({
  belt,
  track,
  nextOrder,
  onDone,
}: {
  belt?: Belt;
  track: 'adult' | 'kids';
  nextOrder?: number;
  onDone: () => void;
}) {
  const { academy } = useAcademy();
  const save = useSaveBelt(academy.id);
  const remove = useDeleteBelt(academy.id);
  const [name, setName] = useState(belt?.name ?? '');
  const [color, setColor] = useState<string | null>(belt?.color_hex ?? '#F5F5F5');
  const [stripe, setStripe] = useState<string | null>(belt?.stripe_color_hex ?? null);
  const [maxDegrees, setMaxDegrees] = useState(String(belt?.max_degrees ?? 4));
  const [error, setError] = useState<string | null>(null);
  const hex = /^#[0-9A-Fa-f]{6}$/;
  const degrees = Number(maxDegrees);

  function handleSave() {
    if (!name.trim()) return setError('Ingresa el nombre.');
    if (!color || !hex.test(color)) return setError('Elige un color válido.');
    if (stripe && !hex.test(stripe)) return setError('La franja debe ser un color válido.');
    if (!Number.isInteger(degrees) || degrees < 0 || degrees > 10) {
      return setError('Los grados van de 0 a 10.');
    }
    setError(null);
    save.mutate(
      {
        id: belt?.id,
        academy_id: academy.id,
        track,
        name: name.trim(),
        color_hex: color.toUpperCase(),
        stripe_color_hex: stripe ? stripe.toUpperCase() : null,
        max_degrees: degrees,
        sort_order: belt?.sort_order ?? nextOrder ?? 1,
      },
      { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) },
    );
  }

  function confirmDelete() {
    Alert.alert('Eliminar cinturón', `¿Eliminar "${belt?.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(belt!.id, {
            onSuccess: onDone,
            onError: (e) => setError(errorMessage(e)),
          }),
      },
    ]);
  }

  const preview: Belt = {
    ...(belt ?? ({} as Belt)),
    name: name || 'Nuevo cinturón',
    color_hex: color && hex.test(color) ? color : '#F5F5F5',
    stripe_color_hex: stripe && hex.test(stripe) ? stripe : null,
    max_degrees: Number.isInteger(degrees) ? degrees : 4,
  };

  return (
    <Section title={belt ? `Editar ${belt.name}` : 'Nuevo cinturón'}>
      <BeltBadge belt={preview} degree={preview.max_degrees} width={160} />
      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Gris y blanco"
      />
      <ColorPicker label="Color" value={color} onChange={setColor} />
      <ColorPicker
        label="Franja central (opcional)"
        value={stripe}
        onChange={setStripe}
        allowNone
      />
      <TextField
        label="Cantidad máxima de grados"
        value={maxDegrees}
        onChangeText={setMaxDegrees}
        keyboardType="number-pad"
      />
      <FormError message={error} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title="Guardar" onPress={handleSave} loading={save.isPending} />
        </View>
        <View style={styles.flex}>
          <Button title="Cancelar" variant="secondary" onPress={onDone} />
        </View>
      </View>
      {belt ? <Button title="Eliminar cinturón" variant="ghost" onPress={confirmDelete} /> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
