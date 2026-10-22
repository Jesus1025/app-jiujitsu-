import { Stack } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, QueryState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useRanking } from '@/features/classes/api';
import { periodOf } from '@/features/payments/api';
import { addDays, todayIn } from '@/lib/format';

const medals = ['🥇', '🥈', '🥉'];

/** Ranking de asistencia (el profesor premia la mejor asistencia del año). */
export default function RankingScreen() {
  const { academy } = useAcademy();
  const today = todayIn(academy.timezone);
  const [range, setRange] = useState<'month' | 'last' | 'year'>('month');
  const thisMonth = `${today.slice(0, 7)}-01`;
  const lastMonth = `${periodOf(today, -1)}-01`;
  const [from, to] =
    range === 'month'
      ? [thisMonth, today]
      : range === 'last'
        ? [lastMonth, addDays(thisMonth, -1)]
        : [`${today.slice(0, 4)}-01-01`, today];
  const ranking = useRanking(academy.id, from, to);

  return (
    <Screen safeArea="bottom" refreshing={ranking.isRefetching} onRefresh={ranking.refetch}>
      <Stack.Screen options={{ title: 'Ranking de asistencia' }} />
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: 'month', label: 'Este mes' },
          { value: 'last', label: 'Mes pasado' },
          { value: 'year', label: 'Este año' },
        ]}
      />
      <QueryState isLoading={ranking.isLoading} error={ranking.error} onRetry={ranking.refetch} />
      {ranking.data && !ranking.data.length ? (
        <EmptyState message="Aún no hay asistencia registrada en este período." />
      ) : null}
      {(ranking.data ?? []).map((row) => (
        <ListItem
          key={row.student_id}
          title={row.display_name}
          left={<ThemedText type="smallBold">{medals[row.rank - 1] ?? `#${row.rank}`}</ThemedText>}
          right={`${row.classes} clases`}
        />
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Premia el esfuerzo: la constancia es lo que más se nota en el tatami.
      </ThemedText>
    </Screen>
  );
}
