import { Stack } from 'expo-router';

import { goBack } from '@/lib/navigation';
import { Screen } from '@/components/ui/screen';
import { CreateAcademyForm } from '@/features/academies/onboarding';

export default function CreateAnotherAcademyScreen() {
  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Crear otra academia' }} />
      <CreateAcademyForm onDone={() => goBack()} />
    </Screen>
  );
}
