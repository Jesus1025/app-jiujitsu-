import { goBack } from '@/lib/navigation';
import { Screen } from '@/components/ui/screen';
import { JoinAcademyForm } from '@/features/academies/onboarding';

export default function JoinAcademyScreen() {
  return (
    <Screen safeArea="bottom">
      <JoinAcademyForm onDone={() => goBack()} />
    </Screen>
  );
}
