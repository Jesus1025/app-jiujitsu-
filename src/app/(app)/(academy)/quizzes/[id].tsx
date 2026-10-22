import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { goBack } from '@/lib/navigation';
import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import {
  useAssignQuiz,
  useDeleteQuiz,
  useQuiz,
  useQuizAnswerKeys,
  useQuizAssignments,
  useSubmitQuiz,
} from '@/features/content/api';
import { useStudents } from '@/features/students/api';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatGrade, fullName } from '@/lib/format';

export default function QuizScreen() {
  const { id, assignment } = useLocalSearchParams<{ id: string; assignment?: string }>();
  const { isStaff } = useAcademy();
  const quiz = useQuiz(id);

  if (!quiz.data) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={quiz.isLoading} error={quiz.error} onRetry={quiz.refetch} />
      </Screen>
    );
  }
  return isStaff && !assignment ? (
    <StaffQuiz data={quiz.data} />
  ) : (
    <TakeQuiz data={quiz.data} assignmentId={assignment ?? ''} />
  );
}

type QuizData = NonNullable<ReturnType<typeof useQuiz>['data']>;

function StaffQuiz({ data }: { data: QuizData }) {
  const { academy } = useAcademy();
  const theme = useTheme();
  const { data: keys } = useQuizAnswerKeys(
    data.questions.map((q) => q.id),
    true,
  );
  const { data: assignments } = useQuizAssignments({ quizId: data.quiz.id });
  const { data: students } = useStudents(academy.id);
  const assign = useAssignQuiz();
  const remove = useDeleteQuiz(academy.id);
  const submitted = (assignments ?? []).filter((a) => a.submitted_at);
  const average = submitted.length
    ? submitted.reduce((sum, a) => sum + (a.grade ?? 0), 0) / submitted.length
    : null;

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: data.quiz.title }} />
      {data.quiz.description ? <ThemedText>{data.quiz.description}</ThemedText> : null}
      <Button
        title="Enviar a todos los alumnos activos"
        loading={assign.isPending}
        onPress={() =>
          assign.mutate(
            { quizId: data.quiz.id },
            {
              onSuccess: (count) =>
                Alert.alert(
                  'Listo',
                  count
                    ? `Se envió a ${count} alumno(s).`
                    : 'Todos los alumnos activos ya la tenían.',
                ),
              onError: (e) => Alert.alert('No se pudo enviar', errorMessage(e)),
            },
          )
        }
      />

      <Section
        title={`Resultados · ${submitted.length} de ${assignments?.length ?? 0} respondidas${average !== null ? ` · promedio ${formatGrade(Math.round(average * 10) / 10)}` : ''}`}>
        {assignments?.length ? (
          assignments.map((a) => {
            const student = students?.find((s) => s.id === a.student_id);
            return (
              <ListItem
                key={a.id}
                title={student ? fullName(student) : 'Alumno'}
                subtitle={
                  a.submitted_at
                    ? `${a.correct_count}/${a.question_count} correctas · ${formatDate(a.submitted_at)}`
                    : 'Pendiente'
                }
                right={a.submitted_at ? `Nota ${formatGrade(a.grade)}` : undefined}
              />
            );
          })
        ) : (
          <EmptyState message="Aún no se envía a nadie." />
        )}
      </Section>

      <Section title="Preguntas">
        {data.questions.map((q, index) => (
          <View key={q.id} style={styles.question}>
            <ThemedText type="smallBold">
              {index + 1}. {q.prompt}
            </ThemedText>
            {q.options.map((option, i) => (
              <ThemedText
                key={i}
                type="small"
                style={
                  keys?.get(q.id) === i ? { color: theme.success, fontWeight: 700 } : undefined
                }>
                {String.fromCharCode(65 + i)}) {option}
                {keys?.get(q.id) === i ? '  ✓' : ''}
              </ThemedText>
            ))}
          </View>
        ))}
      </Section>

      <Button
        title="Eliminar prueba"
        variant="ghost"
        onPress={() =>
          Alert.alert('Eliminar prueba', 'Se borran también las respuestas y notas.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Eliminar',
              style: 'destructive',
              onPress: () => remove.mutate(data.quiz.id, { onSuccess: () => goBack() }),
            },
          ])
        }
      />
    </Screen>
  );
}

function TakeQuiz({ data, assignmentId }: { data: QuizData; assignmentId: string }) {
  const theme = useTheme();
  const { data: assignments } = useQuizAssignments({ quizId: data.quiz.id });
  const submit = useSubmitQuiz();
  const assignment = assignments?.find((a) => a.id === assignmentId);
  const [answers, setAnswers] = useState<(number | null)[]>(data.questions.map(() => null));
  const [error, setError] = useState<string | null>(null);

  if (!assignment)
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={!assignments} error={null} />
      </Screen>
    );

  const submittedAnswers = Array.isArray(assignment.answers)
    ? (assignment.answers as number[])
    : null;

  function handleSubmit() {
    if (answers.some((a) => a === null)) return setError('Responde todas las preguntas.');
    setError(null);
    submit.mutate(
      { assignmentId, answers: answers as number[] },
      { onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: data.quiz.title }} />
      {assignment.submitted_at ? (
        <Card>
          <ThemedText type="smallBold">Prueba enviada</ThemedText>
          <ThemedText type="title">Nota {formatGrade(assignment.grade)}</ThemedText>
          <ThemedText>
            {assignment.correct_count} de {assignment.question_count} respuestas correctas.
          </ThemedText>
        </Card>
      ) : data.quiz.description ? (
        <ThemedText>{data.quiz.description}</ThemedText>
      ) : null}

      {data.questions.map((q, index) => (
        <Section key={q.id} title={`${index + 1}. ${q.prompt}`}>
          {q.options.map((option, i) => {
            const selected = (submittedAnswers ?? answers)[index] === i;
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                disabled={!!assignment.submitted_at}
                onPress={() => setAnswers((a) => a.map((v, j) => (j === index ? i : v)))}
                style={[
                  styles.choice,
                  { borderColor: selected ? theme.primary : theme.border },
                  selected && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText>
                  {String.fromCharCode(65 + i)}) {option}
                </ThemedText>
              </Pressable>
            );
          })}
        </Section>
      ))}

      {!assignment.submitted_at ? (
        <>
          <FormError message={error} />
          <Button title="Enviar respuestas" onPress={handleSubmit} loading={submit.isPending} />
          <Badge label="Solo se puede enviar una vez" />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { gap: Spacing.half, paddingBottom: Spacing.two },
  choice: { borderWidth: 1, borderRadius: 12, padding: Spacing.three },
});
