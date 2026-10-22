import { useQueryClient } from '@tanstack/react-query';
import { Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import {
  pickActiveMembership,
  roleLabels,
  useMyMemberships,
  usePendingRequests,
  useReviewMembership,
} from '@/features/academies/api';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const { data } = useMyMemberships();
  const membership = pickActiveMembership(data);
  const academy = membership?.academy;
  const isStaff = membership?.role === 'owner' || membership?.role === 'instructor';

  async function handleSignOut() {
    await supabase.auth.signOut();
    queryClient.clear();
  }

  if (!membership || !academy) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">{academy.name}</ThemedText>
        <ThemedText themeColor="textSecondary">{roleLabels[membership.role]}</ThemedText>
      </View>

      {isStaff ? (
        <>
          <InviteCard academyName={academy.name} joinCode={academy.join_code} />
          <PendingRequests academyId={academy.id} />
        </>
      ) : (
        <Card>
          <ThemedText type="smallBold">Muy pronto</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Aquí verás tu cinturón, tu asistencia, tus pagos y las novedades de la academia.
          </ThemedText>
        </Card>
      )}

      <View style={styles.footer}>
        <Button title="Cerrar sesión" variant="ghost" onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

function InviteCard({ academyName, joinCode }: { academyName: string; joinCode: string }) {
  return (
    <Card>
      <ThemedText type="smallBold">Código para invitar alumnos</ThemedText>
      <ThemedText type="title" selectable style={styles.code}>
        {joinCode}
      </ThemedText>
      <Button
        title="Compartir código"
        variant="secondary"
        onPress={() =>
          Share.share({
            message: `Únete a ${academyName} en la app con el código ${joinCode}`,
          })
        }
      />
    </Card>
  );
}

function PendingRequests({ academyId }: { academyId: string }) {
  const { data: requests, isLoading } = usePendingRequests(academyId);
  const review = useReviewMembership(academyId);

  return (
    <Card>
      <ThemedText type="smallBold">Solicitudes pendientes</ThemedText>
      {isLoading ? null : !requests?.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          No hay solicitudes por revisar.
        </ThemedText>
      ) : (
        requests.map((request) => {
          const isReviewing = review.isPending && review.variables?.membershipId === request.id;
          return (
            <View key={request.id} style={styles.request}>
              <ThemedText>
                {request.profile?.full_name || 'Sin nombre'} · {roleLabels[request.role]}
              </ThemedText>
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button
                    title="Aprobar"
                    loading={isReviewing && review.variables?.approve}
                    disabled={isReviewing}
                    onPress={() => review.mutate({ membershipId: request.id, approve: true })}
                  />
                </View>
                <View style={styles.action}>
                  <Button
                    title="Rechazar"
                    variant="secondary"
                    loading={isReviewing && !review.variables?.approve}
                    disabled={isReviewing}
                    onPress={() => review.mutate({ membershipId: request.id, approve: false })}
                  />
                </View>
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  code: { letterSpacing: 4 },
  request: { gap: Spacing.two, paddingVertical: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
  footer: { marginTop: 'auto' },
});
