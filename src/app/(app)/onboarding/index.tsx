import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useMyMemberships } from '@/features/academies/api';
import { PendingRequests } from '@/features/academies/onboarding';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function OnboardingScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { refetch, isRefetching } = useMyMemberships();
  const firstName = (session?.user.user_metadata.full_name as string | undefined)?.split(' ')[0];

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
  }

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <View style={styles.header}>
        <ThemedText type="title">¡Hola{firstName ? `, ${firstName}` : ''}!</ThemedText>
        <ThemedText themeColor="textSecondary">
          Para empezar, únete a tu academia con el código que te dio tu profesor, o crea la tuya si
          eres profesor.
        </ThemedText>
      </View>

      <PendingRequests base="onboarding" />

      <Button title="Unirme con un código" onPress={() => router.push('/onboarding/join')} />
      <Button
        title="Crear mi academia (soy profesor)"
        variant="secondary"
        onPress={() => router.push('/onboarding/create-academy')}
      />

      <View style={styles.footer}>
        <Button title="Cerrar sesión" variant="ghost" onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  footer: { marginTop: 'auto' },
});
