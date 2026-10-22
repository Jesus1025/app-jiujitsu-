import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import {
  type Member,
  roleLabels,
  useMembers,
  useReviewMembership,
  useSetMembershipStatus,
} from '@/features/academies/api';
import { errorMessage } from '@/lib/errors';

/** Miembros de la academia por rol, con las solicitudes pendientes arriba. */
export default function MembersScreen() {
  const { academy, isOwner } = useAcademy();
  const members = useMembers(academy.id);
  const review = useReviewMembership();
  const setStatus = useSetMembershipStatus();
  const all = members.data ?? [];
  const pending = all.filter((m) => m.status === 'pending');
  const groups: { title: string; items: Member[] }[] = [
    {
      title: 'Profesores',
      items: all.filter(
        (m) => (m.role === 'owner' || m.role === 'instructor') && m.status !== 'pending',
      ),
    },
    { title: 'Alumnos', items: all.filter((m) => m.role === 'student' && m.status !== 'pending') },
    {
      title: 'Apoderados',
      items: all.filter((m) => m.role === 'guardian' && m.status !== 'pending'),
    },
  ];

  function decide(member: Member, approve: boolean) {
    review.mutate(
      { membershipId: member.id, approve },
      { onError: (e) => Alert.alert('No se pudo guardar', errorMessage(e)) },
    );
  }

  function toggleActive(member: Member) {
    const next = member.status === 'active' ? 'inactive' : 'active';
    Alert.alert(
      next === 'inactive' ? 'Quitar acceso' : 'Devolver acceso',
      next === 'inactive'
        ? `${member.profile?.full_name} ya no podrá entrar a la academia en la app. Su ficha y su historial se mantienen.`
        : `${member.profile?.full_name} podrá volver a entrar a la academia.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => setStatus.mutate({ id: member.id, status: next }) },
      ],
    );
  }

  return (
    <Screen safeArea="bottom" refreshing={members.isRefetching} onRefresh={members.refetch}>
      <Stack.Screen options={{ title: 'Miembros' }} />
      <QueryState isLoading={members.isLoading} error={members.error} onRetry={members.refetch} />

      {pending.length ? (
        <Section title={`Solicitudes pendientes (${pending.length})`}>
          {pending.map((member) => (
            <View key={member.id} style={styles.pending}>
              <ListItem
                title={member.profile?.full_name || 'Sin nombre'}
                subtitle={roleLabels[member.role]}
              />
              {member.role === 'instructor' && !isOwner ? (
                <Badge label="Solo el dueño puede aprobar instructores" />
              ) : (
                <View style={styles.actions}>
                  <View style={styles.action}>
                    <Button title="Aprobar" onPress={() => decide(member, true)} />
                  </View>
                  <View style={styles.action}>
                    <Button
                      title="Rechazar"
                      variant="secondary"
                      onPress={() => decide(member, false)}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Section>
      ) : null}

      {groups.map((group) => (
        <Section key={group.title} title={`${group.title} (${group.items.length})`}>
          {group.items.length ? (
            group.items.map((member) => (
              <ListItem
                key={member.id}
                title={member.profile?.full_name || 'Sin nombre'}
                subtitle={[roleLabels[member.role], member.profile?.phone]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  member.status === 'active' ? undefined : (
                    <Badge label={member.status === 'rejected' ? 'Rechazado' : 'Sin acceso'} />
                  )
                }
                onPress={
                  isOwner && member.role !== 'owner' ? () => toggleActive(member) : undefined
                }
              />
            ))
          ) : (
            <EmptyState message="Nadie todavía." />
          )}
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pending: { gap: Spacing.one, paddingBottom: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
