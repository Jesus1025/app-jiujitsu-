import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { ActiveAcademyProvider, useOptionalAcademy } from '@/features/academies/active-academy';
import { useMyMemberships } from '@/features/academies/api';
import { usePushRegistration } from '@/features/notifications/push';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';

export default function AppLayout() {
  const theme = useTheme();
  const { isLoading, error, refetch } = useMyMemberships();
  usePushRegistration();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText>{errorMessage(error)}</ThemedText>
        <Button title="Reintentar" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <ActiveAcademyProvider>
      <AppStack />
    </ActiveAcademyProvider>
  );
}

function AppStack() {
  const hasAcademy = !!useOptionalAcademy();

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Sin una academia activa solo se ve la entrada: crear o unirse a una. */}
      <Stack.Protected guard={hasAcademy}>
        <Stack.Screen name="(academy)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!hasAcademy}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
