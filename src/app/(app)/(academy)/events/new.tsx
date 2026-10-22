import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DateField, TimeField } from '@/components/ui/date-field';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { QueryState } from '@/components/ui/states';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { eventTypeLabels, useEvent, useSaveEvent } from '@/features/community/api';
import { errorMessage } from '@/lib/errors';
import { isoToZoned, parseAmount, zonedToIso } from '@/lib/format';
import type { Tables } from '@/types/database';

type EventType = 'graduation' | 'seminar' | 'masterclass' | 'competition' | 'other';

/** Crear o editar un evento (graduación, seminario, competencia…). */
export default function EventFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const event = useEvent(id ?? '');
  if (id && !event.data) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={event.isLoading} error={event.error} onRetry={event.refetch} />
      </Screen>
    );
  }
  return <EventForm existing={id ? event.data : undefined} />;
}

function EventForm({ existing }: { existing?: Tables<'events'> }) {
  const { academy } = useAcademy();
  const save = useSaveEvent();
  const start = existing ? isoToZoned(existing.starts_at, academy.timezone) : null;
  const end = existing?.ends_at ? isoToZoned(existing.ends_at, academy.timezone) : null;
  const [type, setType] = useState<EventType | null>((existing?.type as EventType) ?? 'seminar');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState<string | null>(start?.date ?? null);
  const [startTime, setStartTime] = useState<string | null>(start?.time ?? null);
  const [endTime, setEndTime] = useState<string | null>(end?.time ?? null);
  const [location, setLocation] = useState(existing?.location ?? '');
  const [price, setPrice] = useState(existing?.price ? String(existing.price) : '');
  const [weeklyReminder, setWeeklyReminder] = useState(existing?.weekly_reminder ?? true);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) return setError('Ingresa el nombre del evento.');
    if (!date || !startTime) return setError('Ingresa la fecha y la hora de inicio.');
    if (endTime && endTime <= startTime) return setError('La hora de término debe ser posterior.');
    setError(null);
    save.mutate(
      {
        id: existing?.id,
        academy_id: academy.id,
        type: type ?? 'other',
        title: title.trim(),
        description: description.trim() || null,
        starts_at: zonedToIso(date, startTime, academy.timezone),
        ends_at: endTime ? zonedToIso(date, endTime, academy.timezone) : null,
        location: location.trim() || null,
        price: parseAmount(price) ?? 0,
        weekly_reminder: weeklyReminder,
      },
      { onSuccess: () => router.back(), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: existing ? 'Editar evento' : 'Nuevo evento' }} />
      <Select
        label="Tipo"
        value={type}
        onChange={setType}
        options={(Object.keys(eventTypeLabels) as EventType[]).map((key) => ({
          value: key,
          label: eventTypeLabels[key],
        }))}
      />
      <TextField
        label="Nombre"
        value={title}
        onChangeText={setTitle}
        placeholder="Ej: Graduación de fin de año"
      />
      <TextField
        label="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        multiline
        style={styles.multiline}
      />
      <DateField label="Fecha" value={date} onChange={setDate} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TimeField label="Inicio" value={startTime} onChange={setStartTime} />
        </View>
        <View style={styles.flex}>
          <TimeField label="Término (opcional)" value={endTime} onChange={setEndTime} />
        </View>
      </View>
      <TextField label="Lugar (opcional)" value={location} onChangeText={setLocation} />
      <TextField
        label="Valor (vacío si es gratis)"
        value={price}
        onChangeText={setPrice}
        keyboardType="number-pad"
      />
      <SwitchRow
        label="Recordatorio semanal"
        hint="Avisa a los alumnos una vez por semana hasta la fecha."
        value={weeklyReminder}
        onChange={setWeeklyReminder}
      />
      <FormError message={error} />
      <Button title="Guardar evento" onPress={handleSave} loading={save.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  multiline: { minHeight: 88, paddingTop: Spacing.two, textAlignVertical: 'top' },
});
