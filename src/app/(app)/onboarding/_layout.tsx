import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create-academy" options={{ title: 'Crear academia' }} />
      <Stack.Screen name="join" options={{ title: 'Unirme a una academia' }} />
      <Stack.Screen name="student-form" options={{ title: 'Ficha' }} />
      <Stack.Screen name="waiver" options={{ title: 'Exoneración' }} />
    </Stack>
  );
}
