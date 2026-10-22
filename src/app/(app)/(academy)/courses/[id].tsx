import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Select } from '@/components/ui/select';
import { EmptyState, QueryState } from '@/components/ui/states';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import {
  useCourse,
  useDeleteLesson,
  useGrantCourseAccess,
  useRequestCourse,
  useSaveLesson,
} from '@/features/content/api';
import { useMyStudents, useStudents } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { formatMoney, fullName } from '@/lib/format';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy, isStaff } = useAcademy();
  const course = useCourse(id);
  const { data: myStudents } = useMyStudents(academy.id);
  const request = useRequestCourse();
  const removeLesson = useDeleteLesson();
  const [playing, setPlaying] = useState<string | null>(null);

  if (!course.data) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={course.isLoading} error={course.error} onRetry={course.refetch} />
      </Screen>
    );
  }

  const { course: c, lessons, access } = course.data;
  const hasAccess = isStaff || lessons.length > 0 || access.length > 0;
  const current = lessons.find((l) => l.id === playing);
  const student = (myStudents ?? []).find((s) => s.status === 'active');

  return (
    <Screen safeArea="bottom" refreshing={course.isRefetching} onRefresh={course.refetch}>
      <Stack.Screen options={{ title: c.title }} />
      <Card>
        <ThemedText type="subtitle">{c.title}</ThemedText>
        {c.description ? <ThemedText type="small">{c.description}</ThemedText> : null}
        {c.price ? (
          <Badge label={formatMoney(c.price)} tone="primary" />
        ) : (
          <Badge label="Gratis" tone="success" />
        )}
        {isStaff && !c.published ? <Badge label="Borrador (los alumnos no lo ven)" /> : null}
      </Card>

      {current ? <LessonPlayer key={current.id} url={current.video_url} /> : null}

      {hasAccess ? (
        <Section title="Lecciones">
          {lessons.length ? (
            lessons.map((lesson, index) => (
              <ListItem
                key={lesson.id}
                title={`${index + 1}. ${lesson.title}`}
                subtitle={lesson.description}
                right={
                  playing === lesson.id ? <Badge label="Reproduciendo" tone="primary" /> : undefined
                }
                onPress={() => setPlaying(lesson.id)}
              />
            ))
          ) : (
            <EmptyState message="Este curso aún no tiene lecciones." />
          )}
        </Section>
      ) : (
        <Card>
          <ThemedText>
            Para ver las lecciones necesitas acceso al curso. Al pedirlo, tu profesor recibe un
            aviso y te habilita el curso (el cobro queda en Pagos).
          </ThemedText>
          {student ? (
            <Button
              title="Pedir este curso"
              loading={request.isPending}
              onPress={() =>
                request.mutate(
                  { courseId: c.id, studentId: student.id },
                  {
                    onSuccess: () =>
                      Alert.alert(
                        'Solicitud enviada',
                        'Tu profesor te avisará cuando esté habilitado.',
                      ),
                    onError: (e) => Alert.alert('No se pudo enviar', errorMessage(e)),
                  },
                )
              }
            />
          ) : null}
        </Card>
      )}

      {isStaff ? (
        <>
          <LessonForm courseId={c.id} nextPosition={lessons.length + 1} />
          <GrantAccess
            courseId={c.id}
            grantedIds={access.map((a) => a.student_id)}
            price={c.price}
          />
          {lessons.length ? (
            <Section title="Quitar lecciones">
              {lessons.map((lesson) => (
                <ListItem
                  key={lesson.id}
                  title={lesson.title}
                  right={
                    <Button
                      title="Quitar"
                      variant="ghost"
                      onPress={() => removeLesson.mutate(lesson.id)}
                    />
                  }
                />
              ))}
            </Section>
          ) : null}
          <Button
            title="Editar curso"
            variant="secondary"
            onPress={() => router.push({ pathname: '/courses/new', params: { id: c.id } })}
          />
        </>
      ) : null}
    </Screen>
  );
}

function LessonPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

function LessonForm({ courseId, nextPosition }: { courseId: string; nextPosition: number }) {
  const { academy } = useAcademy();
  const save = useSaveLesson();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) return setError('Ingresa el título.');
    if (!/^https?:\/\//.test(videoUrl.trim()))
      return setError('Ingresa la URL del video (https://…).');
    setError(null);
    save.mutate(
      {
        academy_id: academy.id,
        course_id: courseId,
        position: nextPosition,
        title: title.trim(),
        description: description.trim() || null,
        video_url: videoUrl.trim(),
      },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setVideoUrl('');
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <Section title="Agregar lección">
      <TextField label="Título" value={title} onChangeText={setTitle} />
      <TextField label="Descripción (opcional)" value={description} onChangeText={setDescription} />
      <TextField
        label="URL del video (MP4 o HLS)"
        value={videoUrl}
        onChangeText={setVideoUrl}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="https://…"
      />
      <FormError message={error} />
      <Button title="Agregar lección" onPress={handleSave} loading={save.isPending} />
    </Section>
  );
}

function GrantAccess({
  courseId,
  grantedIds,
  price,
}: {
  courseId: string;
  grantedIds: string[];
  price: number;
}) {
  const { academy } = useAcademy();
  const { data: students } = useStudents(academy.id);
  const grant = useGrantCourseAccess();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [createCharge, setCreateCharge] = useState(true);
  const granted = new Set(grantedIds);

  return (
    <Section title={`Alumnos con acceso (${grantedIds.length})`}>
      {(students ?? [])
        .filter((s) => granted.has(s.id))
        .map((s) => (
          <ListItem key={s.id} title={fullName(s)} />
        ))}
      <Select
        label="Dar acceso a"
        value={studentId}
        onChange={setStudentId}
        searchable
        options={(students ?? [])
          .filter((s) => s.status === 'active' && !granted.has(s.id))
          .map((s) => ({ value: s.id, label: fullName(s) }))}
      />
      {price ? (
        <SwitchRow
          label={`Cobrar ${formatMoney(price)}`}
          value={createCharge}
          onChange={setCreateCharge}
        />
      ) : null}
      <Button
        title="Dar acceso"
        disabled={!studentId}
        loading={grant.isPending}
        onPress={() =>
          grant.mutate(
            { courseId, studentId: studentId!, createCharge },
            {
              onSuccess: () => setStudentId(null),
              onError: (e) => Alert.alert('No se pudo dar acceso', errorMessage(e)),
            },
          )
        }
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: '#000' },
});
