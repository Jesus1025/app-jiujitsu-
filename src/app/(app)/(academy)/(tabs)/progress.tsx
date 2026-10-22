import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BeltBadge } from '@/components/belt-badge';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { Stat, StatGrid } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts } from '@/features/academies/api';
import { useRanking } from '@/features/classes/api';
import { useRequirements } from '@/features/community/api';
import {
  type Student,
  useMyStudents,
  useRankAwards,
  useStudentAttendance,
  useStudentProgressList,
} from '@/features/students/api';
import {
  beltTrackFor,
  nextStep,
  requirementStatus,
  trainingTime,
} from '@/features/students/helpers';
import { formatDate, todayIn } from '@/lib/format';

/** Progreso del alumno (o de cada hijo, para apoderados). */
export default function ProgressScreen() {
  const { academy } = useAcademy();
  const myStudents = useMyStudents(academy.id);
  const students = (myStudents.data ?? []).filter((s) => s.status !== 'pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const student = students.find((s) => s.id === selectedId) ?? students[0];

  return (
    <Screen safeArea="none" refreshing={myStudents.isRefetching} onRefresh={myStudents.refetch}>
      {students.length > 1 ? (
        <Segmented
          value={student?.id ?? ''}
          onChange={setSelectedId}
          options={students.map((s) => ({ value: s.id, label: s.first_name }))}
        />
      ) : null}
      {student ? (
        <StudentProgress key={student.id} student={student} />
      ) : (
        <EmptyState message="Tu progreso aparecerá aquí cuando tu ficha esté aprobada." />
      )}
    </Screen>
  );
}

function StudentProgress({ student }: { student: Student }) {
  const { academy, settings } = useAcademy();
  const today = todayIn(academy.timezone);
  const { data: progressMap } = useStudentProgressList(academy.id);
  const { data: belts } = useBelts(academy.id);
  const { data: requirements } = useRequirements(academy.id);
  const { data: ranks } = useRankAwards(student.id);
  const { data: attendance } = useStudentAttendance(student.id, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const { data: ranking } = useRanking(academy.id, monthStart, today);

  const progress = progressMap?.get(student.id);
  const belt = belts?.find((b) => b.id === progress?.belt_id);
  const step = nextStep(
    progress,
    belts,
    beltTrackFor(student.birth_date, today, settings.adult_belt_age),
  );
  const status = requirementStatus(step, requirements, progress, student.joined_at, today);
  const position = ranking?.find((r) => r.student_id === student.id);

  return (
    <View style={styles.stack}>
      <Card>
        <ThemedText type="smallBold">Cinturón actual</ThemedText>
        <BeltBadge belt={belt} degree={progress?.degree} width={200} />
        {progress?.awarded_at ? (
          <ThemedText type="small" themeColor="textSecondary">
            Desde el {formatDate(progress.awarded_at)}
          </ThemedText>
        ) : null}
      </Card>

      <StatGrid>
        <Stat label="Entrenando" value={trainingTime(student.joined_at, today)} />
        <Stat label="Clases totales" value={progress?.total_classes ?? 0} />
        <Stat label="Desde el último grado" value={progress?.classes_since_award ?? 0} />
        {settings.show_ranking_to_students ? (
          <Stat
            label="Puesto este mes"
            value={position ? `#${position.rank} (${position.classes})` : '—'}
          />
        ) : null}
      </StatGrid>

      {step ? (
        <Section title="Hacia el próximo grado">
          <BeltBadge belt={step.belt} degree={step.degree} />
          {status ? (
            <>
              <ProgressBar
                label={`Clases: ${status.classes} de ${status.requirement.min_classes}`}
                value={status.classes / Math.max(status.requirement.min_classes, 1)}
              />
              <ProgressBar
                label={`Tiempo: ${status.months} de ${status.requirement.min_months} meses`}
                value={status.months / Math.max(status.requirement.min_months, 1)}
              />
              {status.requirement.notes ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {status.requirement.notes}
                </ThemedText>
              ) : null}
              {status.ready ? (
                <Badge label="¡Cumples los requisitos! Habla con tu profesor." tone="success" />
              ) : null}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Tu profesor aún no definió los requisitos para este grado.
            </ThemedText>
          )}
        </Section>
      ) : null}

      <Section title="Asistencia reciente">
        {attendance?.length ? (
          attendance.map((a) => (
            <ListItem
              key={a.id}
              title={a.session?.title ?? 'Clase'}
              subtitle={formatDate(a.session?.date)}
              right={a.is_late ? <Badge label="Atraso" tone="warning" /> : undefined}
            />
          ))
        ) : (
          <EmptyState message="Aún no registras asistencia." />
        )}
        <Button
          title="Marcar asistencia"
          variant="secondary"
          onPress={() => router.push('/checkin')}
        />
      </Section>

      <Section title="Historial de grados">
        {ranks?.length ? (
          ranks.map((rank) => {
            const rankBelt = belts?.find((b) => b.id === rank.belt_id);
            return (
              <ListItem
                key={rank.id}
                title={`${rankBelt?.name ?? 'Cinturón'}${rank.degree ? ` · ${rank.degree}° grado` : ''}`}
                subtitle={formatDate(rank.awarded_at)}
              />
            );
          })
        ) : (
          <EmptyState message="Sin grados registrados todavía." />
        )}
      </Section>

      <Button
        title="Ver mi ficha completa"
        variant="ghost"
        onPress={() => router.push(`/students/${student.id}`)}
      />
    </View>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.bar}>
      <ThemedText type="small">{label}</ThemedText>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  bar: { gap: Spacing.one },
  track: { height: 8, borderRadius: 4, backgroundColor: '#8884', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#2E7D32' },
});
