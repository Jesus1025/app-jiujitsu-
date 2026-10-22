import { router } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { JoinAcademyForm } from '@/features/academies/onboarding';

export default function JoinAcademyScreen() {
  return (
    <Screen safeArea="bottom">
      <JoinAcademyForm onDone={() => router.back()} />
    </Screen>
  );
}
