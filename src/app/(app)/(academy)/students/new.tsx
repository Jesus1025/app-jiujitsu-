import { router, Stack } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { useAcademy } from '@/features/academies/active-academy';
import { useCreateStudent, useUploadStudentPhoto } from '@/features/students/api';
import { StudentForm } from '@/features/students/student-form';
import { useAuth } from '@/lib/auth';

/** Nuevo alumno: el profesor lo carga activo; un apoderado inscribe a su hijo (queda por aprobar). */
export default function NewStudentScreen() {
  const { academy, isStaff } = useAcademy();
  const { session } = useAuth();
  const create = useCreateStudent();
  const upload = useUploadStudentPhoto();
  const mode = isStaff ? 'staff' : 'guardian';

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: isStaff ? 'Nuevo alumno' : 'Inscribir a mi hijo/a' }} />
      <StudentForm
        academyId={academy.id}
        mode={mode}
        submitLabel={isStaff ? 'Guardar alumno' : 'Guardar y firmar exoneración'}
        onSave={async (values, photoUri) => {
          const student = await create.mutateAsync({
            ...values,
            academy_id: academy.id,
            status: isStaff ? 'active' : 'pending',
            guardian_user_id: isStaff ? null : (session?.user.id ?? null),
          });
          if (photoUri) await upload.mutateAsync({ student, uri: photoUri });
          if (isStaff) router.replace(`/students/${student.id}`);
          else router.replace(`/students/${student.id}/waiver`);
        }}
      />
    </Screen>
  );
}
