import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { useMyMemberships } from '@/features/academies/api';
import { PendingRequests } from '@/features/academies/onboarding';

export default function MyRequestsScreen() {
  const { data } = useMyMemberships();
  const hasPending = (data ?? []).some((m) => m.status === 'pending');

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Mis solicitudes' }} />
      {hasPending ? (
        <PendingRequests base="academies" />
      ) : (
        <EmptyState message="No tienes solicitudes pendientes." />
      )}
    </Screen>
  );
}
