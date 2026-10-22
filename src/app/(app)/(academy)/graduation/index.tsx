import { router, Stack } from 'expo-router';

import { BeltBadge } from '@/components/belt-badge';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts } from '@/features/academies/api';
import { useRequirements } from '@/features/community/api';
import { useStudentProgressList, useStudents } from '@/features/students/api';
import { beltTrackFor, nextStep, requirementStatus } from '@/features/students/helpers';
import { fullName, todayIn } from '@/lib/format';

/** Candidatos a graduación según los requisitos definidos por el profesor. */
export default function GraduationScreen() {
  const { academy, settings, isOwner } = useAcademy();
  const canAward = isOwner || settings.instructors_can_award_ranks;
  const today = todayIn(academy.timezone);
  const students = useStudents(academy.id);
  const { data: progress } = useStudentProgressList(academy.id);
  const { data: belts } = useBelts(academy.id);
  const { data: requirements } = useRequirements(academy.id);

  const rows = (students.data ?? [])
    .filter((s) => s.status === 'active')
    .map((student) => {
      const p = progress?.get(student.id);
      const step = nextStep(
        p,
        belts,
        beltTrackFor(student.birth_date, today, settings.adult_belt_age),
      );
      const status = requirementStatus(step, requirements, p, student.joined_at, today);
      const score = status
        ? Math.min(
            status.classes / Math.max(status.requirement.min_classes, 1),
            status.months / Math.max(status.requirement.min_months, 1),
          )
        : 0;
      return { student, step, status, score };
    })
    .filter((row) => row.status)
    .sort((a, b) => b.score - a.score);

  const ready = rows.filter((r) => r.status?.ready);
  const close = rows.filter((r) => !r.status?.ready && r.score >= 0.8);

  return (
    <Screen safeArea="bottom" refreshing={students.isRefetching} onRefresh={students.refetch}>
      <Stack.Screen options={{ title: 'Graduación' }} />
      <Button
        title="Definir requisitos por grado"
        variant="secondary"
        onPress={() => router.push('/graduation/requirements')}
      />
      {!requirements?.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          Define cuántas clases y meses se necesitan para cada grado y aquí verás quién está listo
          para graduarse.
        </ThemedText>
      ) : null}

      <Section title={`Cumplen los requisitos (${ready.length})`}>
        {ready.length ? (
          ready.map(({ student, step, status }) => (
            <ListItem
              key={student.id}
              title={fullName(student)}
              subtitle={`${status?.classes} clases · ${status?.months} meses en el grado`}
              left={<Avatar name={fullName(student)} photoPath={student.photo_path} />}
              right={
                <BeltBadge belt={step?.belt} degree={step?.degree} showLabel={false} width={60} />
              }
              onPress={() =>
                router.push(canAward ? `/students/${student.id}/rank` : `/students/${student.id}`)
              }
            />
          ))
        ) : (
          <EmptyState message="Nadie cumple todavía los requisitos del siguiente grado." />
        )}
      </Section>

      <Section title={`Cerca (más del 80 %) (${close.length})`}>
        {close.length ? (
          close.map(({ student, status }) => (
            <ListItem
              key={student.id}
              title={fullName(student)}
              subtitle={`${status?.classes}/${status?.requirement.min_classes} clases · ${status?.months}/${status?.requirement.min_months} meses`}
              left={<Avatar name={fullName(student)} photoPath={student.photo_path} />}
              onPress={() => router.push(`/students/${student.id}`)}
            />
          ))
        ) : (
          <EmptyState message="Sin alumnos cerca del siguiente grado." />
        )}
      </Section>
    </Screen>
  );
}
