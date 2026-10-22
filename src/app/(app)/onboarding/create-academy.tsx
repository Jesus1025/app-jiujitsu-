import { Screen } from '@/components/ui/screen';
import { CreateAcademyForm } from '@/features/academies/onboarding';

// Al crearla, el layout detecta la academia activa y abre el inicio solo.
export default function CreateAcademyScreen() {
  return (
    <Screen safeArea="bottom">
      <CreateAcademyForm onDone={() => {}} />
    </Screen>
  );
}
