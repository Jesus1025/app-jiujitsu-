import { router, Stack } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { CreateAcademyForm } from '@/features/academies/onboarding';

export default function CreateAnotherAcademyScreen() {
  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Crear otra academia' }} />
      <CreateAcademyForm onDone={() => router.back()} />
    </Screen>
  );
}
