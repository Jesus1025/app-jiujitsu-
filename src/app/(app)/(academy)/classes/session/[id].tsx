import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { EmptyState, QueryState } from '@/components/ui/states';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useCategories } from '@/features/academies/api';
import {
  useSchedules,
  useSession,
  useSessionAttendance,
  useSetAttendance,
  useUpdateSession,
} from '@/features/classes/api';
import { useStudents } from '@/features/students/api';
import { categoryFor } from '@/features/students/helpers';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, fullName } from '@/lib/format';

/** Toma de asistencia de una clase: tocar el nombre marca presente; el reloj marca atraso. */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy } = useAcademy();
  const theme = useTheme();
  const session = useSession(id);
  const attendance = useSessionAttendance(id);
  const { data: students } = useStudents(academy.id);
  const { data: schedules } = useSchedules(academy.id);
  const { data: categories } = useCategories(academy.id);
  const setAttendance = useSetAttendance();
  const updateSession = useUpdateSession();
  const [onlyCategory, setOnlyCategory] = useState(true);
  const [query, setQuery] = useState('');

  if (!session.data) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={session.isLoading} error={session.error} onRetry={session.refetch} />
      </Screen>
    );
  }

  const current = session.data;
  const schedule = schedules?.find((s) => s.id === current.schedule_id);
  const category = categories?.find((c) => c.id === schedule?.category_id);
  const present = attendance.data ?? new Map();
  const normalized = query.trim().toLowerCase();
  const roster = (students ?? [])
    .filter((s) => s.status === 'active')
    .filter(
      (s) =>
        !category ||
        !onlyCategory ||
        present.has(s.id) ||
        categoryFor(s.birth_date, categories, current.date)?.id === category.id,
    )
    .filter((s) => !normalized || fullName(s).toLowerCase().includes(normalized));

  function toggle(studentId: string, nextPresent: boolean, isLate = false) {
    setAttendance.mutate(
      { academyId: academy.id, sessionId: current.id, studentId, present: nextPresent, isLate },
      { onError: (e) => Alert.alert('No se pudo guardar', errorMessage(e)) },
    );
  }

  return (
    <Screen
      safeArea="bottom"
      refreshing={attendance.isRefetching}
      onRefresh={() => attendance.refetch()}>
      <Stack.Screen options={{ title: current.title }} />

      <Card>
        <ThemedText type="smallBold">
          {current.title} · {formatDate(current.date)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateTime(current.starts_at, academy.timezone)} ·{' '}
          {category ? category.name : 'Todas las categorías'}
        </ThemedText>
        <ThemedText type="subtitle">{present.size} presentes</ThemedText>
        {current.status === 'cancelled' ? <Badge label="Clase cancelada" tone="danger" /> : null}
      </Card>

      {category ? (
        <SwitchRow
          label={`Solo alumnos de ${category.name}`}
          value={onlyCategory}
          onChange={setOnlyCategory}
        />
      ) : null}
      <TextField label="Buscar alumno" value={query} onChangeText={setQuery} />

      {roster.length ? (
        <View>
          {roster.map((student) => {
            const record = present.get(student.id);
            const isPresent = !!record;
            return (
              <View key={student.id} style={[styles.row, { borderColor: theme.border }]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isPresent }}
                  onPress={() => toggle(student.id, !isPresent)}
                  style={styles.rowMain}>
                  <Avatar name={fullName(student)} photoPath={student.photo_path} />
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {fullName(student)}
                  </ThemedText>
                  <View
                    style={[
                      styles.check,
                      { borderColor: isPresent ? theme.success : theme.border },
                      isPresent && { backgroundColor: theme.success },
                    ]}>
                    {isPresent ? <ThemedText style={styles.checkMark}>✓</ThemedText> : null}
                  </View>
                </Pressable>
                {isPresent ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={record.is_late ? 'Quitar atraso' : 'Marcar atraso'}
                    onPress={() => toggle(student.id, true, !record.is_late)}>
                    <Badge
                      label={record.is_late ? 'Atraso' : 'A tiempo'}
                      tone={record.is_late ? 'warning' : 'success'}
                    />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState message="No hay alumnos activos para esta clase." />
      )}

      {current.status === 'cancelled' ? (
        <Button
          title="Reactivar clase"
          variant="secondary"
          onPress={() => updateSession.mutate({ id: current.id, status: 'scheduled' })}
        />
      ) : (
        <Button
          title="Marcar clase como cancelada"
          variant="ghost"
          onPress={() => updateSession.mutate({ id: current.id, status: 'cancelled' })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flex: 1 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#ffffff', fontWeight: 700 },
});
