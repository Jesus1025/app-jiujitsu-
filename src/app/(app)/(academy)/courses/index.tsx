import { router, Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { EmptyState, QueryState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useCourses } from '@/features/content/api';
import { formatMoney } from '@/lib/format';

export default function CoursesScreen() {
  const { academy, isStaff } = useAcademy();
  const courses = useCourses(academy.id);

  return (
    <Screen safeArea="bottom" refreshing={courses.isRefetching} onRefresh={courses.refetch}>
      <Stack.Screen options={{ title: 'Cursos en video' }} />
      {isStaff ? <Button title="Nuevo curso" onPress={() => router.push('/courses/new')} /> : null}
      <QueryState isLoading={courses.isLoading} error={courses.error} onRetry={courses.refetch} />
      {courses.data && !courses.data.length ? (
        <EmptyState
          message={
            isStaff
              ? 'Crea un curso (ej. pasajes de guardia) y súbele lecciones en video.'
              : 'Aún no hay cursos disponibles.'
          }
        />
      ) : null}
      {(courses.data ?? []).map((course) => (
        <ListItem
          key={course.id}
          title={course.title}
          subtitle={course.description}
          right={
            !course.published ? (
              <Badge label="Borrador" />
            ) : course.price ? (
              formatMoney(course.price)
            ) : (
              <Badge label="Gratis" tone="success" />
            )
          }
          onPress={() => router.push(`/courses/${course.id}`)}
        />
      ))}
      {isStaff ? (
        <ThemedText type="small" themeColor="textSecondary">
          Importante: si cobras los cursos dentro de la app, Apple y Google exigen usar su sistema
          de pagos. Por eso aquí el acceso se otorga manualmente y el cobro queda en Pagos (ver
          docs/PLAN.md).
        </ThemedText>
      ) : null}
    </Screen>
  );
}
