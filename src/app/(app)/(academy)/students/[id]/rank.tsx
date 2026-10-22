import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BeltBadge } from '@/components/belt-badge';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts } from '@/features/academies/api';
import { useAwardRank, useStudent, useStudentProgressList } from '@/features/students/api';
import { beltTrackFor, nextStep } from '@/features/students/helpers';
import { errorMessage } from '@/lib/errors';
import { fullName, todayIn } from '@/lib/format';

/** Otorgar cinturón o grado: propone el siguiente paso según el grado actual. */
export default function AwardRankScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy } = useAcademy();
  const { data: student, isLoading, error, refetch } = useStudent(id);
  const { data: belts } = useBelts(academy.id);
  const { data: progressMap } = useStudentProgressList(academy.id);
  const award = useAwardRank();
  const today = todayIn(academy.timezone);

  const defaultTrack = student ? beltTrackFor(student.birth_date, today) : 'adult';
  const suggested = student ? nextStep(progressMap?.get(student.id), belts, defaultTrack) : null;

  const [track, setTrack] = useState<'adult' | 'kids' | null>(null);
  const [beltId, setBeltId] = useState<string | null>(null);
  const [degree, setDegree] = useState<number | null>(null);
  const [awardedAt, setAwardedAt] = useState<string | null>(today);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!student || !belts) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={isLoading || !belts} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const activeTrack =
    track ?? (suggested?.belt.track as 'adult' | 'kids' | undefined) ?? defaultTrack;
  const selectedBeltId = beltId ?? suggested?.belt.id ?? null;
  const selectedBelt = belts.find((b) => b.id === selectedBeltId);
  const selectedDegree = degree ?? suggested?.degree ?? 0;
  const maxDegrees = selectedBelt?.max_degrees ?? 4;

  function handleSave() {
    if (!selectedBeltId) return setFormError('Elige el cinturón.');
    if (!awardedAt) return setFormError('Ingresa la fecha.');
    setFormError(null);
    award.mutate(
      {
        academy_id: academy.id,
        student_id: student!.id,
        belt_id: selectedBeltId,
        degree: selectedDegree,
        awarded_at: awardedAt,
        notes: notes.trim() || null,
      },
      { onSuccess: () => router.back(), onError: (e) => setFormError(errorMessage(e)) },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Otorgar grado' }} />
      <ThemedText>{fullName(student)}</ThemedText>

      <View style={styles.field}>
        <ThemedText type="smallBold">Sistema de cinturones</ThemedText>
        <Segmented
          value={activeTrack}
          onChange={(value) => {
            setTrack(value);
            setBeltId(belts.find((b) => b.track === value)?.id ?? null);
            setDegree(0);
          }}
          options={[
            { value: 'adult', label: 'Adulto' },
            { value: 'kids', label: 'Kids' },
          ]}
        />
      </View>

      <Select
        label="Cinturón"
        value={selectedBeltId}
        onChange={(value) => {
          setBeltId(value);
          setDegree(0);
        }}
        options={belts
          .filter((b) => b.track === activeTrack)
          .map((b) => ({ value: b.id, label: b.name }))}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold">Grado</ThemedText>
        <Segmented
          value={String(Math.min(selectedDegree, maxDegrees))}
          onChange={(value) => setDegree(Number(value))}
          options={Array.from({ length: maxDegrees + 1 }, (_, n) => ({
            value: String(n),
            label: n === 0 ? 'Liso' : `${n}°`,
          }))}
        />
      </View>

      <BeltBadge belt={selectedBelt} degree={selectedDegree} width={180} />

      <DateField label="Fecha" value={awardedAt} onChange={setAwardedAt} />
      <TextField label="Notas (opcional)" value={notes} onChangeText={setNotes} />
      <FormError message={formError} />
      <Button title="Otorgar" onPress={handleSave} loading={award.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
});
