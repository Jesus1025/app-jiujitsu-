import { router, Stack } from 'expo-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useQuizAssignments, useQuizzes } from '@/features/content/api';
import { useMyStudents } from '@/features/students/api';
import { formatDate, formatGrade } from '@/lib/format';

export default function QuizzesScreen() {
  const { isStaff } = useAcademy();
  return isStaff ? <StaffQuizzes /> : <MyQuizzes />;
}

function StaffQuizzes() {
  const { academy } = useAcademy();
  const quizzes = useQuizzes(academy.id);

  return (
    <Screen safeArea="bottom" refreshing={quizzes.isRefetching} onRefresh={quizzes.refetch}>
      <Stack.Screen options={{ title: 'Pruebas' }} />
      <Button title="Nueva prueba" onPress={() => router.push('/quizzes/new')} />
      <QueryState isLoading={quizzes.isLoading} error={quizzes.error} onRetry={quizzes.refetch} />
      {quizzes.data && !quizzes.data.length ? (
        <EmptyState message="Crea una prueba sobre el manual del alumno nuevo (linaje, historia, puntaje, reglamento) y envíala a los alumnos." />
      ) : null}
      {(quizzes.data ?? []).map((quiz) => (
        <ListItem
          key={quiz.id}
          title={quiz.title}
          subtitle={
            quiz.auto_send_after_months
              ? `Se envía sola a los ${quiz.auto_send_after_months} meses de ingreso`
              : `Creada el ${formatDate(quiz.created_at)}`
          }
          onPress={() => router.push(`/quizzes/${quiz.id}`)}
        />
      ))}
    </Screen>
  );
}

function MyQuizzes() {
  const { academy } = useAcademy();
  const { data: students } = useMyStudents(academy.id);
  const { data: quizzes } = useQuizzes(academy.id);
  const assignments = useQuizAssignments({ studentIds: (students ?? []).map((s) => s.id) });
  const pending = (assignments.data ?? []).filter((a) => !a.submitted_at);
  const done = (assignments.data ?? []).filter((a) => a.submitted_at);
  const label = (a: { quiz_id: string; student_id: string }) => {
    const title = quizzes?.find((q) => q.id === a.quiz_id)?.title ?? 'Prueba';
    const student = students?.find((s) => s.id === a.student_id);
    return (students?.length ?? 0) > 1 && student ? `${title} · ${student.first_name}` : title;
  };

  return (
    <Screen safeArea="bottom" refreshing={assignments.isRefetching} onRefresh={assignments.refetch}>
      <Stack.Screen options={{ title: 'Pruebas' }} />
      <Section title="Por responder">
        {pending.length ? (
          pending.map((a) => (
            <ListItem
              key={a.id}
              title={label(a)}
              subtitle={`Enviada el ${formatDate(a.assigned_at)}`}
              right={<Badge label="Pendiente" tone="primary" />}
              onPress={() =>
                router.push({
                  pathname: '/quizzes/[id]',
                  params: { id: a.quiz_id, assignment: a.id },
                })
              }
            />
          ))
        ) : (
          <EmptyState message="No tienes pruebas pendientes." />
        )}
      </Section>
      <Section title="Respondidas">
        {done.length ? (
          done.map((a) => (
            <ListItem
              key={a.id}
              title={label(a)}
              subtitle={`${a.correct_count} de ${a.question_count} correctas`}
              right={`Nota ${formatGrade(a.grade)}`}
              onPress={() =>
                router.push({
                  pathname: '/quizzes/[id]',
                  params: { id: a.quiz_id, assignment: a.id },
                })
              }
            />
          ))
        ) : (
          <EmptyState message="Aún no respondes pruebas." />
        )}
      </Section>
    </Screen>
  );
}
