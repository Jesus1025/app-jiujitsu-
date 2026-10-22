import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/lib/navigation';
import { Screen } from '@/components/ui/screen';
import { QueryState } from '@/components/ui/states';
import { useStudent } from '@/features/students/api';
import { WaiverForm } from '@/features/students/waiver-form';
import { useAuth } from '@/lib/auth';

export default function StudentWaiverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { data: student, isLoading, error, refetch } = useStudent(id);

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Exoneración' }} />
      {student ? (
        <WaiverForm
          student={student}
          defaultSignerName={session?.user.user_metadata.full_name as string}
          onDone={() => goBack()}
        />
      ) : (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}
