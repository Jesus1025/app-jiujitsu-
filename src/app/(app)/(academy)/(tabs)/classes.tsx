import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useCategories } from '@/features/academies/api';
import {
  useAttendanceCounts,
  useEnsureSession,
  useSchedules,
  useSessionsOn,
} from '@/features/classes/api';
import { errorMessage } from '@/lib/errors';
import { addDays, formatDate, formatTime, todayIn, weekdayNames, weekdayOf } from '@/lib/format';

/** Clases de un día: abrir una para tomar asistencia. */
export default function ClassesScreen() {
  const { academy } = useAcademy();
  const today = todayIn(academy.timezone);
  const [date, setDate] = useState(today);
  const schedules = useSchedules(academy.id);
  const sessions = useSessionsOn(academy.id, date);
  const { data: categories } = useCategories(academy.id);
  const counts = useAttendanceCounts((sessions.data ?? []).map((s) => s.id));
  const ensure = useEnsureSession();

  const weekday = weekdayOf(date);
  const dayClasses = (schedules.data ?? []).filter((s) => s.active && s.weekday === weekday);

  function openClass(scheduleId: string) {
    const existing = sessions.data?.find((s) => s.schedule_id === scheduleId);
    if (existing) {
      router.push(`/classes/session/${existing.id}`);
      return;
    }
    ensure.mutate(
      { scheduleId, date },
      {
        onSuccess: (session) => router.push(`/classes/session/${session.id}`),
        onError: (e) => Alert.alert('No se pudo abrir la clase', errorMessage(e)),
      },
    );
  }

  return (
    <Screen
      safeArea="none"
      refreshing={sessions.isRefetching}
      onRefresh={() => {
        schedules.refetch();
        sessions.refetch();
      }}>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="QR de asistencia" onPress={() => router.push('/classes/qr')} />
        </View>
        <View style={styles.action}>
          <Button
            title="Editar horario"
            variant="secondary"
            onPress={() => router.push('/classes/schedule')}
          />
        </View>
      </View>

      <View style={styles.dayPicker}>
        <Button title="‹" variant="secondary" onPress={() => setDate(addDays(date, -1))} />
        <View style={styles.dayLabel}>
          <ThemedText type="smallBold">{date === today ? 'Hoy' : weekdayNames[weekday]}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {weekdayNames[weekday]} {formatDate(date)}
          </ThemedText>
        </View>
        <Button title="›" variant="secondary" onPress={() => setDate(addDays(date, 1))} />
      </View>

      <QueryState
        isLoading={schedules.isLoading}
        error={schedules.error}
        onRetry={schedules.refetch}
      />

      <Section title="Clases del día">
        {dayClasses.length ? (
          dayClasses.map((schedule) => {
            const session = sessions.data?.find((s) => s.schedule_id === schedule.id);
            const count = session ? (counts.data?.get(session.id) ?? 0) : 0;
            const category = categories?.find((c) => c.id === schedule.category_id);
            return (
              <ListItem
                key={schedule.id}
                title={`${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)} · ${schedule.title}`}
                subtitle={category ? category.name : 'Todas las categorías'}
                right={
                  session?.status === 'cancelled' ? (
                    <Badge label="Cancelada" tone="danger" />
                  ) : session ? (
                    <Badge label={`${count} presentes`} tone="primary" />
                  ) : undefined
                }
                onPress={() => openClass(schedule.id)}
              />
            );
          })
        ) : (
          <EmptyState
            message={
              schedules.data?.length
                ? 'No hay clases este día.'
                : 'Aún no hay horario. Toca "Editar horario" para crear las clases de la semana.'
            }
          />
        )}
      </Section>

      <Button
        title="Ranking de asistencia"
        variant="ghost"
        onPress={() => router.push('/ranking')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
  dayPicker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayLabel: { flex: 1, alignItems: 'center' },
});
