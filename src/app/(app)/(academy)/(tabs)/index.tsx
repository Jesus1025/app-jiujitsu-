import { router } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { BeltBadge } from '@/components/belt-badge';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Stat, StatGrid } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import {
  roleLabels,
  useBelts,
  useDashboard,
  useMembers,
  useMyMemberships,
  useReviewMembership,
} from '@/features/academies/api';
import { useAnnouncements, useEvents } from '@/features/community/api';
import { useQuizAssignments } from '@/features/content/api';
import {
  useMyStudents,
  useStudentBalances,
  useStudentProgressList,
  useStudents,
} from '@/features/students/api';
import { trainingTime } from '@/features/students/helpers';
import { formatDateTime, formatMoney, fullName, todayIn } from '@/lib/format';

export default function HomeScreen() {
  const { isStaff } = useAcademy();
  return isStaff ? <StaffHome /> : <MemberHome />;
}

// ---------------------------------------------------------------------------
// Profesor / instructor
// ---------------------------------------------------------------------------

function StaffHome() {
  const { academy } = useAcademy();
  const dashboard = useDashboard(academy.id);
  const stats = dashboard.data;

  return (
    <Screen safeArea="none" refreshing={dashboard.isRefetching} onRefresh={dashboard.refetch}>
      <StatGrid>
        <Stat label="Alumnos activos" value={stats?.active_students ?? '—'} />
        <Stat label="Asistencias este mes" value={stats?.attendance_this_month ?? '—'} />
        <Stat label="Ingresos del mes" value={stats ? formatMoney(stats.income_this_month) : '—'} />
        <Stat label="Por cobrar" value={stats ? formatMoney(stats.pending_amount) : '—'} />
      </StatGrid>
      {stats?.overdue_students ? (
        <Button
          title={`${stats.overdue_students} alumno(s) con pagos atrasados`}
          variant="danger"
          onPress={() => router.push('/payments')}
        />
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Tomar asistencia" onPress={() => router.push('/classes')} />
        </View>
        <View style={styles.action}>
          <Button
            title="QR de asistencia"
            variant="secondary"
            onPress={() => router.push('/classes/qr')}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title="Nuevo alumno"
            variant="secondary"
            onPress={() => router.push('/students/new')}
          />
        </View>
        <View style={styles.action}>
          <Button
            title="Publicar noticia"
            variant="secondary"
            onPress={() => router.push('/news/new')}
          />
        </View>
      </View>

      <InviteCard />
      <PendingApprovals />
      <UpcomingEvents />
    </Screen>
  );
}

function InviteCard() {
  const { academy } = useAcademy();
  return (
    <Section title="Código para invitar alumnos">
      <ThemedText type="title" selectable style={styles.code}>
        {academy.join_code}
      </ThemedText>
      <Button
        title="Compartir por WhatsApp u otra app"
        variant="secondary"
        onPress={() =>
          Share.share({
            message:
              `Únete a ${academy.name} en la app de la academia. ` +
              `Crea tu cuenta y usa el código ${academy.join_code}.`,
          })
        }
      />
    </Section>
  );
}

/** Solicitudes de ingreso y fichas pendientes de aprobar. */
function PendingApprovals() {
  const { academy, isOwner } = useAcademy();
  const { data: members } = useMembers(academy.id);
  const { data: students } = useStudents(academy.id);
  const review = useReviewMembership();

  const requests = (members ?? []).filter(
    (m) => m.status === 'pending' && (isOwner || m.role === 'student' || m.role === 'guardian'),
  );
  // Fichas pendientes de personas cuya membresía ya está activa (ej. un apoderado agregó otro hijo).
  const pendingUserIds = new Set(requests.map((r) => r.user_id));
  const pendingRecords = (students ?? []).filter(
    (s) =>
      s.status === 'pending' &&
      !pendingUserIds.has(s.user_id ?? '') &&
      !pendingUserIds.has(s.guardian_user_id ?? ''),
  );

  if (!requests.length && !pendingRecords.length) return null;

  return (
    <Section title="Por aprobar">
      {requests.map((request) => {
        const records = (students ?? []).filter(
          (s) => s.user_id === request.user_id || s.guardian_user_id === request.user_id,
        );
        const isReviewing = review.isPending && review.variables?.membershipId === request.id;
        return (
          <View key={request.id} style={styles.request}>
            <ListItem
              title={request.profile?.full_name || 'Sin nombre'}
              subtitle={`${roleLabels[request.role]} · ${
                request.role === 'instructor'
                  ? 'Instructor'
                  : records.length
                    ? `Ficha: ${records.map(fullName).join(', ')}`
                    : 'Aún no completa la ficha'
              }`}
              onPress={records[0] ? () => router.push(`/students/${records[0].id}`) : undefined}
            />
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
      })}
      {pendingRecords.map((student) => (
        <ListItem
          key={student.id}
          title={fullName(student)}
          subtitle="Ficha nueva por aprobar"
          left={<Avatar name={fullName(student)} photoPath={student.photo_path} />}
          onPress={() => router.push(`/students/${student.id}`)}
        />
      ))}
    </Section>
  );
}

function UpcomingEvents() {
  const { academy } = useAcademy();
  const { data: events } = useEvents(academy.id);
  const next = (events ?? []).slice(0, 3);

  return (
    <Section
      title="Próximos eventos"
      action={
        <Button title="Ver calendario" variant="ghost" onPress={() => router.push('/calendar')} />
      }>
      {next.length ? (
        next.map((event) => (
          <ListItem
            key={event.id}
            title={event.title}
            subtitle={formatDateTime(event.starts_at, academy.timezone)}
            onPress={() => router.push(`/events/${event.id}`)}
          />
        ))
      ) : (
        <EmptyState message="No hay eventos próximos." />
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Alumno / apoderado
// ---------------------------------------------------------------------------

function MemberHome() {
  const { academy, role } = useAcademy();
  const myStudents = useMyStudents(academy.id);
  const { data: progress } = useStudentProgressList(academy.id);
  const { data: balances } = useStudentBalances(academy.id);
  const { data: belts } = useBelts(academy.id);
  const { data: techniques } = useAnnouncements(academy.id, 'technique', 1);
  const { data: news } = useAnnouncements(academy.id, 'news', 3);
  const { data: events } = useEvents(academy.id);
  const { data: memberships } = useMyMemberships();
  const students = myStudents.data ?? [];
  const { data: quizzes } = useQuizAssignments({ studentIds: students.map((s) => s.id) });
  const today = todayIn(academy.timezone);

  const pendingAmount = students.reduce(
    (sum, s) => sum + (balances?.get(s.id)?.pending_amount ?? 0),
    0,
  );
  const pendingQuizzes = (quizzes ?? []).filter((q) => !q.submitted_at).length;
  const technique = techniques?.[0];
  const nextEvent = events?.[0];
  const otherPending = (memberships ?? []).some((m) => m.status === 'pending');

  return (
    <Screen safeArea="none" refreshing={myStudents.isRefetching} onRefresh={myStudents.refetch}>
      {students.map((student) => {
        const p = progress?.get(student.id);
        return (
          <Card key={student.id}>
            <ListItem
              title={fullName(student)}
              subtitle={
                student.status === 'active'
                  ? `Entrenando hace ${trainingTime(student.joined_at, today)} · ${p?.total_classes ?? 0} clases`
                  : 'Ficha pendiente de aprobación'
              }
              left={<Avatar name={fullName(student)} photoPath={student.photo_path} size={48} />}
              onPress={() => router.push(`/students/${student.id}`)}
            />
            <BeltBadge belt={belts?.find((b) => b.id === p?.belt_id)} degree={p?.degree} />
          </Card>
        );
      })}
      {role === 'guardian' ? (
        <Button
          title={students.length ? 'Inscribir a otro hijo o hija' : 'Inscribir a mi hijo o hija'}
          variant="secondary"
          onPress={() => router.push({ pathname: '/students/new', params: { mode: 'guardian' } })}
        />
      ) : null}

      <Button title="Marcar asistencia (escanear QR)" onPress={() => router.push('/checkin')} />

      {pendingAmount > 0 ? (
        <Card>
          <ThemedText type="smallBold">Pagos pendientes</ThemedText>
          <ThemedText type="subtitle">{formatMoney(pendingAmount)}</ThemedText>
          <Button
            title="Ver detalle"
            variant="secondary"
            onPress={() => router.push('/payments')}
          />
        </Card>
      ) : null}

      {pendingQuizzes ? (
        <Card>
          <View style={styles.inline}>
            <ThemedText type="smallBold">
              Tienes {pendingQuizzes} prueba(s) por responder
            </ThemedText>
            <Badge label="Nuevo" tone="primary" />
          </View>
          <Button title="Responder" variant="secondary" onPress={() => router.push('/quizzes')} />
        </Card>
      ) : null}

      {technique ? (
        <Section title="Técnica de la semana">
          <ThemedText type="smallBold">{technique.title}</ThemedText>
          <ThemedText type="small">{technique.body}</ThemedText>
        </Section>
      ) : null}

      {nextEvent ? (
        <Section title="Próximo evento">
          <ListItem
            title={nextEvent.title}
            subtitle={formatDateTime(nextEvent.starts_at, academy.timezone)}
            onPress={() => router.push(`/events/${nextEvent.id}`)}
          />
        </Section>
      ) : null}

      <Section
        title="Noticias"
        action={<Button title="Ver todas" variant="ghost" onPress={() => router.push('/news')} />}>
        {news?.length ? (
          news.map((item) => (
            <View key={item.id} style={styles.news}>
              <ThemedText type="smallBold">{item.title}</ThemedText>
              <ThemedText type="small" numberOfLines={3}>
                {item.body}
              </ThemedText>
            </View>
          ))
        ) : (
          <EmptyState message="Aún no hay noticias." />
        )}
      </Section>

      {otherPending ? (
        <Button
          title="Tienes solicitudes pendientes en otra academia"
          variant="ghost"
          onPress={() => router.push('/academies/requests')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
  code: { letterSpacing: 4 },
  request: { gap: Spacing.one, paddingBottom: Spacing.two },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  news: { gap: 2 },
});
