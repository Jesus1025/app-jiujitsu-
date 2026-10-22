import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/ui/screen';
import { useAcademy } from '@/features/academies/active-academy';
import {
  type Student,
  useCreateStudent,
  useUpdateStudent,
  useUploadStudentPhoto,
} from '@/features/students/api';
import { StudentForm } from '@/features/students/student-form';
import { useAuth } from '@/lib/auth';

/** Nuevo alumno: el profesor lo carga activo; un apoderado inscribe a su hijo (queda por aprobar). */
export default function NewStudentScreen() {
  const { academy, isStaff } = useAcademy();
  const { session } = useAuth();
  const create = useCreateStudent();
  const update = useUpdateStudent();
  const upload = useUploadStudentPhoto();
  // Si la ficha se creó pero falló la foto, el reintento actualiza en vez de duplicar.
  const [created, setCreated] = useState<Student | null>(null);
  const mode = isStaff ? 'staff' : 'guardian';

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: isStaff ? 'Nuevo alumno' : 'Inscribir a mi hijo/a' }} />
      <StudentForm
        academyId={academy.id}
        mode={mode}
        submitLabel={isStaff ? 'Guardar alumno' : 'Guardar y firmar exoneración'}
        onSave={async (values, photoUri) => {
          let student = created;
          if (student) {
            await update.mutateAsync({ id: student.id, values });
          } else {
            student = await create.mutateAsync({
              ...values,
              academy_id: academy.id,
              status: isStaff ? 'active' : 'pending',
              guardian_user_id: isStaff ? null : (session?.user.id ?? null),
            });
            setCreated(student);
          }
          if (photoUri) await upload.mutateAsync({ student, uri: photoUri });
          if (isStaff) router.replace(`/students/${student.id}`);
          else router.replace(`/students/${student.id}/waiver`);
        }}
      />
    </Screen>
  );
}
