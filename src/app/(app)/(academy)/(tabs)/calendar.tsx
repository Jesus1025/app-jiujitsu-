import { router } from 'expo-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useCategories } from '@/features/academies/api';
import { useSchedules } from '@/features/classes/api';
import { eventTypeLabels, useEvents } from '@/features/community/api';
import { formatDateTime, formatMoney, formatTime, weekdayNames } from '@/lib/format';

const weekOrder = [1, 2, 3, 4, 5, 6, 0];

/** Próximos eventos y horario semanal de clases. */
export default function CalendarScreen() {
  const { academy, isStaff } = useAcademy();
  const events = useEvents(academy.id);
  const { data: schedules } = useSchedules(academy.id);
  const { data: categories } = useCategories(academy.id);

  return (
    <Screen safeArea="none" refreshing={events.isRefetching} onRefresh={events.refetch}>
      {isStaff ? <Button title="Nuevo evento" onPress={() => router.push('/events/new')} /> : null}

      <Section title="Próximos eventos">
        {events.data?.length ? (
          events.data.map((event) => (
            <ListItem
              key={event.id}
              title={event.title}
              subtitle={`${eventTypeLabels[event.type] ?? 'Evento'} · ${formatDateTime(event.starts_at, academy.timezone)}`}
              right={event.price ? <Badge label={formatMoney(event.price)} /> : undefined}
              onPress={() => router.push(`/events/${event.id}`)}
            />
          ))
        ) : (
          <EmptyState message="No hay eventos próximos." />
        )}
      </Section>

      <Section title="Horario de clases">
        {schedules?.filter((s) => s.active).length ? (
          weekOrder.map((weekday) =>
            (schedules ?? [])
              .filter((s) => s.active && s.weekday === weekday)
              .map((s) => (
                <ListItem
                  key={s.id}
                  title={`${weekdayNames[weekday]} ${formatTime(s.start_time)}–${formatTime(s.end_time)}`}
                  subtitle={`${s.title} · ${
                    categories?.find((c) => c.id === s.category_id)?.name ?? 'Todas las categorías'
                  }`}
                />
              )),
          )
        ) : (
          <EmptyState message="El horario aún no está publicado." />
        )}
      </Section>
    </Screen>
  );
}
