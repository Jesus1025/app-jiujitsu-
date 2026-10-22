import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/lib/navigation';
import { Screen } from '@/components/ui/screen';
import { QueryState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useStudent, useUpdateStudent, useUploadStudentPhoto } from '@/features/students/api';
import { StudentForm } from '@/features/students/student-form';

export default function EditStudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy, isStaff } = useAcademy();
  const { data: student, isLoading, error, refetch } = useStudent(id);
  const update = useUpdateStudent();
  const upload = useUploadStudentPhoto();

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Editar ficha' }} />
      {student ? (
        <StudentForm
          academyId={academy.id}
          mode={isStaff ? 'staff' : student.user_id ? 'self' : 'guardian'}
          initial={student}
          submitLabel="Guardar cambios"
          onSave={async (values, photoUri) => {
            await update.mutateAsync({ id: student.id, values });
            if (photoUri) await upload.mutateAsync({ student, uri: photoUri });
            goBack();
          }}
        />
      ) : (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}
