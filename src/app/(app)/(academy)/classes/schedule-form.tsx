import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { goBack } from '@/lib/navigation';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TimeField } from '@/components/ui/date-field';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { QueryState } from '@/components/ui/states';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useCategories, useMembers } from '@/features/academies/api';
import {
  type ClassSchedule,
  useDeleteSchedule,
  useSaveSchedule,
  useSchedules,
} from '@/features/classes/api';
import { errorMessage } from '@/lib/errors';
import { formatTime, weekdayNames } from '@/lib/format';

export default function ScheduleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { academy } = useAcademy();
  const schedules = useSchedules(academy.id);
  const existing = schedules.data?.find((s) => s.id === id);

  if (id && !existing) {
    return (
      <Screen safeArea="bottom">
        <QueryState
          isLoading={schedules.isLoading}
          error={schedules.error}
          onRetry={schedules.refetch}
        />
      </Screen>
    );
  }
  return <ScheduleForm id={id} existing={existing} />;
}

function ScheduleForm({ id, existing }: { id?: string; existing?: ClassSchedule }) {
  const { academy } = useAcademy();
  const { data: categories } = useCategories(academy.id);
  const { data: members } = useMembers(academy.id);
  const save = useSaveSchedule(academy.id);
  const remove = useDeleteSchedule(academy.id);

  const [weekday, setWeekday] = useState<string | null>(existing ? String(existing.weekday) : null);
  const [start, setStart] = useState<string | null>(
    existing ? formatTime(existing.start_time) : null,
  );
  const [end, setEnd] = useState<string | null>(existing ? formatTime(existing.end_time) : null);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null);
  const [instructorId, setInstructorId] = useState<string | null>(existing?.instructor_id ?? null);
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const instructors = (members ?? []).filter(
    (m) => m.status === 'active' && (m.role === 'owner' || m.role === 'instructor'),
  );

  function handleSave() {
    if (weekday === null) return setError('Elige el día.');
    if (!start || !end) return setError('Ingresa la hora de inicio y de término.');
    if (end <= start) return setError('La hora de término debe ser posterior al inicio.');
    if (!title.trim()) return setError('Ingresa el nombre de la clase.');
    setError(null);
    save.mutate(
      {
        id,
        academy_id: academy.id,
        weekday: Number(weekday),
        start_time: start,
        end_time: end,
        title: title.trim(),
        category_id: categoryId,
        instructor_id: instructorId,
        active,
      },
      { onSuccess: () => goBack(), onError: (e) => setError(errorMessage(e)) },
    );
  }

  function handleDelete() {
    Alert.alert(
      'Eliminar clase',
      'Se quita del horario. La asistencia ya registrada se mantiene.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => remove.mutate(id!, { onSuccess: () => goBack() }),
        },
      ],
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: id ? 'Editar clase' : 'Nueva clase' }} />
      <Select
        label="Día"
        value={weekday}
        onChange={setWeekday}
        options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: weekdayNames[d] }))}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TimeField label="Inicio" value={start} onChange={setStart} />
        </View>
        <View style={styles.flex}>
          <TimeField label="Término" value={end} onChange={setEnd} />
        </View>
      </View>
      <TextField
        label="Nombre de la clase"
        value={title}
        onChangeText={setTitle}
        placeholder="Ej: Adultos fundamentos"
      />
      <Select
        label="Categoría"
        value={categoryId}
        onChange={setCategoryId}
        allowClear
        placeholder="Todas las categorías"
        options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
      />
      <Select
        label="Profesor a cargo"
        value={instructorId}
        onChange={setInstructorId}
        allowClear
        placeholder="Sin asignar"
        options={instructors.map((m) => ({
          value: m.user_id,
          label: m.profile?.full_name || 'Sin nombre',
        }))}
      />
      <SwitchRow
        label="Clase activa"
        hint="Desactívala para pausarla sin borrarla (ej. vacaciones)."
        value={active}
        onChange={setActive}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Los alumnos pueden marcar asistencia con el QR desde 30 minutos antes del inicio hasta el
        término de la clase.
      </ThemedText>
      <FormError message={error} />
      <Button title="Guardar" onPress={handleSave} loading={save.isPending} />
      {id ? <Button title="Eliminar del horario" variant="ghost" onPress={handleDelete} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
