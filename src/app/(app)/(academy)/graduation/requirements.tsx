import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { BeltBadge } from '@/components/belt-badge';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts } from '@/features/academies/api';
import {
  useDeleteRequirement,
  useRequirements,
  useSaveRequirement,
} from '@/features/community/api';
import { errorMessage } from '@/lib/errors';

/** Programa de graduación: clases y meses mínimos para llegar a cada cinturón/grado. */
export default function RequirementsScreen() {
  const { academy } = useAcademy();
  const { data: belts } = useBelts(academy.id);
  const { data: requirements } = useRequirements(academy.id);
  const save = useSaveRequirement(academy.id);
  const remove = useDeleteRequirement(academy.id);
  const [track, setTrack] = useState<'adult' | 'kids'>('adult');
  const [beltId, setBeltId] = useState<string | null>(null);
  const [degree, setDegree] = useState(0);
  const [minClasses, setMinClasses] = useState('');
  const [minMonths, setMinMonths] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const trackBelts = (belts ?? []).filter((b) => b.track === track);
  const belt = trackBelts.find((b) => b.id === beltId);

  function selectStep(nextBeltId: string | null, nextDegree: number) {
    setBeltId(nextBeltId);
    setDegree(nextDegree);
    const existing = requirements?.find((r) => r.belt_id === nextBeltId && r.degree === nextDegree);
    setMinClasses(existing ? String(existing.min_classes) : '');
    setMinMonths(existing ? String(existing.min_months) : '');
    setNotes(existing?.notes ?? '');
  }

  function handleSave() {
    if (!beltId) return setError('Elige el cinturón.');
    const classes = Number(minClasses || 0);
    const months = Number(minMonths || 0);
    if (!Number.isInteger(classes) || !Number.isInteger(months))
      return setError('Usa números enteros.');
    setError(null);
    save.mutate(
      {
        academy_id: academy.id,
        belt_id: beltId,
        degree,
        min_classes: classes,
        min_months: months,
        notes: notes.trim() || null,
      },
      { onError: (e) => setError(errorMessage(e)) },
    );
  }

  const sorted = [...(requirements ?? [])].sort((a, b) => {
    const ba = belts?.find((x) => x.id === a.belt_id);
    const bb = belts?.find((x) => x.id === b.belt_id);
    return (
      (ba?.track ?? '').localeCompare(bb?.track ?? '') ||
      (ba?.sort_order ?? 0) - (bb?.sort_order ?? 0) ||
      a.degree - b.degree
    );
  });

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Requisitos de graduación' }} />
      <ThemedText type="small" themeColor="textSecondary">
        Cada requisito indica qué se necesita para llegar a ese cinturón y grado, contando desde el
        último grado obtenido.
      </ThemedText>

      <Section title="Agregar o editar requisito">
        <Segmented
          value={track}
          onChange={(value) => {
            setTrack(value);
            selectStep(null, 0);
          }}
          options={[
            { value: 'adult', label: 'Adulto' },
            { value: 'kids', label: 'Kids' },
          ]}
        />
        <Select
          label="Cinturón al que se llega"
          value={beltId}
          onChange={(value) => selectStep(value, 0)}
          options={trackBelts.map((b) => ({ value: b.id, label: b.name }))}
        />
        {belt ? (
          <>
            <Segmented
              value={String(degree)}
              onChange={(value) => selectStep(beltId, Number(value))}
              options={Array.from({ length: belt.max_degrees + 1 }, (_, n) => ({
                value: String(n),
                label: n === 0 ? 'Liso' : `${n}°`,
              }))}
            />
            <BeltBadge belt={belt} degree={degree} />
          </>
        ) : null}
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Clases mínimas"
              value={minClasses}
              onChangeText={setMinClasses}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Meses mínimos"
              value={minMonths}
              onChangeText={setMinMonths}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <TextField
          label="Otros requisitos (opcional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Ej: dominar 3 raspadas y 2 pasajes, asistir a un torneo"
          multiline
        />
        <FormError message={error} />
        <Button title="Guardar requisito" onPress={handleSave} loading={save.isPending} />
      </Section>

      <Section title="Requisitos definidos">
        {sorted.length ? (
          sorted.map((r) => {
            const b = belts?.find((x) => x.id === r.belt_id);
            return (
              <ListItem
                key={r.id}
                title={`${b?.track === 'kids' ? 'Kids · ' : ''}${b?.name ?? ''}${r.degree ? ` ${r.degree}°` : ' liso'}`}
                subtitle={`${r.min_classes} clases · ${r.min_months} meses${r.notes ? ` · ${r.notes}` : ''}`}
                onPress={() => {
                  if (b) setTrack(b.track);
                  selectStep(r.belt_id, r.degree);
                }}
                right={
                  <Button
                    title="Quitar"
                    variant="ghost"
                    onPress={() =>
                      Alert.alert('Quitar requisito', '¿Eliminar este requisito?', [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Quitar',
                          style: 'destructive',
                          onPress: () => remove.mutate(r.id),
                        },
                      ])
                    }
                  />
                }
              />
            );
          })
        ) : (
          <EmptyState message="Aún no hay requisitos." />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
