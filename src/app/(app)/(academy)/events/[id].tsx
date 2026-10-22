import { router, Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/lib/navigation';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import {
  eventTypeLabels,
  useDeleteEvent,
  useEvent,
  useEventRegistrations,
  useRegisterForEvent,
} from '@/features/community/api';
import { useMyStudents, useStudents } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney, fullName } from '@/lib/format';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy, isStaff } = useAcademy();
  const event = useEvent(id);
  const { data: registrations } = useEventRegistrations(id);
  const { data: myStudents } = useMyStudents(academy.id);
  const { data: allStudents } = useStudents(academy.id);
  const register = useRegisterForEvent();
  const remove = useDeleteEvent();

  if (!event.data) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={event.isLoading} error={event.error} onRetry={event.refetch} />
      </Screen>
    );
  }

  const e = event.data;
  const registered = new Set((registrations ?? []).map((r) => r.student_id));
  const mine = (myStudents ?? []).filter((s) => s.status === 'active');

  function signUp(studentId: string) {
    register.mutate(
      { eventId: e.id, studentId },
      {
        onSuccess: () =>
          Alert.alert(
            '¡Inscrito!',
            e.price ? `Se agregó el cobro de ${formatMoney(e.price)} en Pagos.` : 'Te esperamos.',
          ),
        onError: (err) => Alert.alert('No se pudo inscribir', errorMessage(err)),
      },
    );
  }

  function confirmDelete() {
    Alert.alert('Eliminar evento', '¿Seguro? Se borran también las inscripciones.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => remove.mutate(e.id, { onSuccess: () => goBack() }),
      },
    ]);
  }

  return (
    <Screen safeArea="bottom" refreshing={event.isRefetching} onRefresh={event.refetch}>
      <Stack.Screen options={{ title: eventTypeLabels[e.type] ?? 'Evento' }} />
      <Card>
        <ThemedText type="subtitle">{e.title}</ThemedText>
        <ThemedText>{formatDateTime(e.starts_at, academy.timezone)}</ThemedText>
        {e.location ? <ThemedText type="small">📍 {e.location}</ThemedText> : null}
        {e.price ? (
          <Badge label={formatMoney(e.price)} tone="primary" />
        ) : (
          <Badge label="Gratis" tone="success" />
        )}
        {e.description ? <ThemedText type="small">{e.description}</ThemedText> : null}
      </Card>

      {mine.map((student) =>
        registered.has(student.id) ? (
          <Badge key={student.id} label={`${student.first_name} está inscrito/a`} tone="success" />
        ) : (
          <Button
            key={student.id}
            title={mine.length > 1 ? `Inscribir a ${student.first_name}` : 'Inscribirme'}
            onPress={() => signUp(student.id)}
            loading={register.isPending && register.variables?.studentId === student.id}
          />
        ),
      )}

      {isStaff ? (
        <>
          <Section title={`Inscritos (${registrations?.length ?? 0})`}>
            {registrations?.length ? (
              registrations.map((r) => {
                const student = allStudents?.find((s) => s.id === r.student_id);
                return (
                  <ListItem
                    key={r.id}
                    title={student ? fullName(student) : 'Alumno'}
                    onPress={() => router.push(`/students/${r.student_id}`)}
                  />
                );
              })
            ) : (
              <EmptyState message="Aún no hay inscritos." />
            )}
          </Section>
          <Button
            title="Editar evento"
            variant="secondary"
            onPress={() => router.push({ pathname: '/events/new', params: { id: e.id } })}
          />
          <Button title="Eliminar evento" variant="ghost" onPress={confirmDelete} />
        </>
      ) : null}
    </Screen>
  );
}
