import { router, Stack } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { JoinAcademyForm } from '@/features/academies/onboarding';

export default function JoinAnotherAcademyScreen() {
  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Unirme a otra academia' }} />
      <JoinAcademyForm onDone={() => router.replace('/academies/requests')} />
    </Screen>
  );
}
