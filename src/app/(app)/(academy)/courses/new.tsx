import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { QueryState } from '@/components/ui/states';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import { useCourses, useSaveCourse } from '@/features/content/api';
import { errorMessage } from '@/lib/errors';
import { parseAmount } from '@/lib/format';
import type { Tables } from '@/types/database';

export default function CourseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { academy } = useAcademy();
  const courses = useCourses(academy.id);
  const course = courses.data?.find((c) => c.id === id);

  if (id && !course) {
    return (
      <Screen safeArea="bottom">
        <QueryState isLoading={courses.isLoading} error={courses.error} onRetry={courses.refetch} />
      </Screen>
    );
  }
  return <CourseForm course={course} />;
}

function CourseForm({ course }: { course?: Tables<'courses'> }) {
  const { academy } = useAcademy();
  const save = useSaveCourse(academy.id);
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [price, setPrice] = useState(course?.price ? String(course.price) : '');
  const [published, setPublished] = useState(course?.published ?? false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) return setError('Ingresa el título.');
    setError(null);
    save.mutate(
      {
        id: course?.id,
        academy_id: academy.id,
        title: title.trim(),
        description: description.trim() || null,
        price: parseAmount(price) ?? 0,
        published,
      },
      {
        onSuccess: (id) => (course ? goBack() : router.replace(`/courses/${id}`)),
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: course ? 'Editar curso' : 'Nuevo curso' }} />
      <TextField
        label="Título"
        value={title}
        onChangeText={setTitle}
        placeholder="Ej: Pasajes de guardia"
      />
      <TextField label="Descripción" value={description} onChangeText={setDescription} multiline />
      <TextField
        label="Valor (vacío si es gratis)"
        value={price}
        onChangeText={setPrice}
        keyboardType="number-pad"
      />
      <SwitchRow
        label="Publicado"
        hint="Los alumnos solo ven los cursos publicados."
        value={published}
        onChange={setPublished}
      />
      <FormError message={error} />
      <Button title="Guardar" onPress={handleSave} loading={save.isPending} />
    </Screen>
  );
}
