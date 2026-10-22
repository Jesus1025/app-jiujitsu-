import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { pickActiveMembership, useMyMemberships } from '@/features/academies/api';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';

export default function AppLayout() {
  const theme = useTheme();
  const { data, isLoading, error, refetch } = useMyMemberships();

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

  // Sin una academia activa, el usuario solo ve la pantalla para crear o unirse a una.
  const hasAcademy = !!pickActiveMembership(data);

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={hasAcademy}>
        <Stack.Screen name="index" options={{ title: 'Inicio' }} />
      </Stack.Protected>
      <Stack.Protected guard={!hasAcademy}>
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/create-academy" options={{ title: 'Crear academia' }} />
        <Stack.Screen name="onboarding/join" options={{ title: 'Unirme a una academia' }} />
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
