import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { QueryState } from '@/components/ui/states';
import type { FlowBase } from '@/features/academies/onboarding';
import { useCreateStudent, useStudent, useUploadStudentPhoto } from '@/features/students/api';
import { StudentForm } from '@/features/students/student-form';
import { WaiverForm } from '@/features/students/waiver-form';
import { useAuth } from '@/lib/auth';

/** Pantalla para que un alumno complete su ficha o un apoderado inscriba a su hijo. */
export function PendingStudentFormScreen({ base }: { base: FlowBase }) {
  const { academy, mode } = useLocalSearchParams<{ academy: string; mode: 'self' | 'guardian' }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const create = useCreateStudent();
  const upload = useUploadStudentPhoto();

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: mode === 'self' ? 'Mi ficha' : 'Ficha de mi hijo/a' }} />
      <StudentForm
        academyId={academy}
        mode={mode}
        initialName={mode === 'self' ? (session?.user.user_metadata.full_name as string) : ''}
        submitLabel="Guardar y continuar"
        onSave={async (values, photoUri) => {
          const student = await create.mutateAsync({
            ...values,
            academy_id: academy,
            user_id: mode === 'self' ? userId : null,
            guardian_user_id: mode === 'guardian' ? userId : null,
          });
          if (photoUri) await upload.mutateAsync({ student, uri: photoUri });
          const params = { student: student.id };
          if (base === 'onboarding') router.replace({ pathname: '/onboarding/waiver', params });
          else router.replace({ pathname: '/academies/waiver', params });
        }}
      />
    </Screen>
  );
}

export function PendingWaiverScreen() {
  const { student: studentId } = useLocalSearchParams<{ student: string }>();
  const { session } = useAuth();
  const { data: student, isLoading, error, refetch } = useStudent(studentId);

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Exoneración' }} />
      {student ? (
        <WaiverForm
          student={student}
          defaultSignerName={session?.user.user_metadata.full_name as string}
          onDone={() => router.back()}
        />
      ) : (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}
