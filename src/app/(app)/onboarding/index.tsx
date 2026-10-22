import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { roleLabels, useMyMemberships } from '@/features/academies/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function OnboardingScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data, refetch, isRefetching } = useMyMemberships();
  const pending = (data ?? []).filter((m) => m.status === 'pending');
  const firstName = (session?.user.user_metadata.full_name as string | undefined)?.split(' ')[0];

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">¡Hola{firstName ? `, ${firstName}` : ''}!</ThemedText>
        <ThemedText themeColor="textSecondary">
          Para empezar, crea tu academia o únete a una con el código que te dio tu profesor.
        </ThemedText>
      </View>

      {pending.map((m) => (
        <Card key={m.id}>
          <ThemedText type="smallBold">Solicitud enviada a {m.academy?.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Como {roleLabels[m.role].toLowerCase()}. Cuando te aprueben podrás entrar.
          </ThemedText>
          <Button
            title="Revisar de nuevo"
            variant="secondary"
            onPress={() => refetch()}
            loading={isRefetching}
          />
        </Card>
      ))}

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
    marginBottom: Spacing.three,
  },
  footer: {
    marginTop: 'auto',
  },
});
