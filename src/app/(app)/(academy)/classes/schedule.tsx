import { router, Stack } from 'expo-router';

import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { Badge } from '@/components/ui/badge';
import { useAcademy } from '@/features/academies/active-academy';
import { useCategories } from '@/features/academies/api';
import { useSchedules } from '@/features/classes/api';
import { formatTime, weekdayNames } from '@/lib/format';

// Lunes primero, domingo al final.
const weekOrder = [1, 2, 3, 4, 5, 6, 0];

export default function ScheduleScreen() {
  const { academy } = useAcademy();
  const schedules = useSchedules(academy.id);
  const { data: categories } = useCategories(academy.id);

  return (
    <Screen safeArea="bottom" refreshing={schedules.isRefetching} onRefresh={schedules.refetch}>
      <Stack.Screen options={{ title: 'Horario semanal' }} />
      <Button title="Agregar clase" onPress={() => router.push('/classes/schedule-form')} />
      <QueryState
        isLoading={schedules.isLoading}
        error={schedules.error}
        onRetry={schedules.refetch}
      />
      {schedules.data && !schedules.data.length ? (
        <EmptyState message="Agrega las clases de la semana (día, hora y categoría)." />
      ) : null}
      {weekOrder.map((weekday) => {
        const items = (schedules.data ?? []).filter((s) => s.weekday === weekday);
        if (!items.length) return null;
        return (
          <Section key={weekday} title={weekdayNames[weekday]}>
            {items.map((item) => (
              <ListItem
                key={item.id}
                title={`${formatTime(item.start_time)} – ${formatTime(item.end_time)} · ${item.title}`}
                subtitle={
                  categories?.find((c) => c.id === item.category_id)?.name ?? 'Todas las categorías'
                }
                right={item.active ? undefined : <Badge label="Pausada" />}
                onPress={() =>
                  router.push({ pathname: '/classes/schedule-form', params: { id: item.id } })
                }
              />
            ))}
          </Section>
        );
      })}
    </Screen>
  );
}
