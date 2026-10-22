import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { BeltBadge } from '@/components/belt-badge';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Select } from '@/components/ui/select';
import { Stat, StatGrid } from '@/components/ui/stat';
import { EmptyState, QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts, useCategories, useMembers } from '@/features/academies/api';
import { useRequirements } from '@/features/community/api';
import { useQuizAssignments, useQuizzes } from '@/features/content/api';
import { conceptLabels, useCharges, useFeePlans } from '@/features/payments/api';
import {
  useDeleteRankAward,
  useDeleteStudent,
  useLinkStudentAccount,
  useRankAwards,
  useStudent,
  useStudentAttendance,
  useStudentProgressList,
  useStudents,
  useUpdateStudent,
  useWaiverSignatures,
} from '@/features/students/api';
import {
  beltTrackFor,
  categoryFor,
  nextStep,
  requirementStatus,
  studentStatusLabels,
  trainingTime,
} from '@/features/students/helpers';
import { exportStudentPdf } from '@/features/students/pdf';
import { errorMessage } from '@/lib/errors';
import { ageOn, formatDate, formatMoney, fullName, todayIn } from '@/lib/format';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { academy, isStaff, isOwner } = useAcademy();
  const studentQuery = useStudent(id);
  const student = studentQuery.data;
  const { data: progressMap } = useStudentProgressList(academy.id);
  const { data: belts } = useBelts(academy.id);
  const { data: categories } = useCategories(academy.id);
  const { data: requirements } = useRequirements(academy.id);
  const { data: ranks } = useRankAwards(id);
  const { data: signatures } = useWaiverSignatures(id);
  const { data: attendance } = useStudentAttendance(id, 15);
  const { data: charges } = useCharges({ studentId: id });
  const { data: plans } = useFeePlans(academy.id);
  const { data: quizAssignments } = useQuizAssignments({ studentIds: [id] });
  const { data: quizzes } = useQuizzes(academy.id);
  const update = useUpdateStudent();
  const remove = useDeleteStudent();
  const removeRank = useDeleteRankAward();
  const [leaving, setLeaving] = useState(false);
  const [leftReason, setLeftReason] = useState('');
  const [exporting, setExporting] = useState(false);
  const today = todayIn(academy.timezone);

  if (!student) {
    return (
      <Screen safeArea="bottom">
        <Stack.Screen options={{ title: 'Ficha' }} />
        <QueryState
          isLoading={studentQuery.isLoading}
          error={studentQuery.error}
          onRetry={studentQuery.refetch}
        />
      </Screen>
    );
  }

  const progress = progressMap?.get(student.id);
  const belt = belts?.find((b) => b.id === progress?.belt_id);
  const category = categoryFor(student.birth_date, categories, today);
  const step = nextStep(progress, belts, beltTrackFor(student.birth_date, today));
  const status = requirementStatus(step, requirements, progress, student.joined_at, today);
  const signature = signatures?.[0];
  const pendingCharges = (charges ?? []).filter((c) => c.status === 'pending');
  const debt = pendingCharges.reduce((sum, c) => sum + (c.remaining ?? 0), 0);

  function setStatus(next: 'active' | 'inactive') {
    update.mutate(
      {
        id: student!.id,
        values:
          next === 'inactive'
            ? { status: 'inactive', left_at: today, left_reason: leftReason.trim() || null }
            : { status: 'active', left_at: null, left_reason: null },
      },
      {
        onSuccess: () => setLeaving(false),
        onError: (e) => Alert.alert('No se pudo guardar', errorMessage(e)),
      },
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Eliminar ficha',
      'Se borrará la ficha con todo su historial (asistencia, grados y pagos). Si el alumno solo dejó de venir, mejor dalo de baja.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            remove.mutate(student!.id, {
              onSuccess: () => router.back(),
              onError: (e) => Alert.alert('No se pudo eliminar', errorMessage(e)),
            }),
        },
      ],
    );
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportStudentPdf({
        academyName: academy.name,
        student: student!,
        progress,
        belts,
        categories,
        ranks,
        signature,
        today,
      });
    } catch (error) {
      Alert.alert('No se pudo generar el PDF', errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen
      safeArea="bottom"
      refreshing={studentQuery.isRefetching}
      onRefresh={studentQuery.refetch}>
      <Stack.Screen options={{ title: fullName(student) }} />

      <Card>
        <View style={styles.header}>
          <Avatar name={fullName(student)} photoPath={student.photo_path} size={72} />
          <View style={styles.headerText}>
            <ThemedText type="subtitle">{fullName(student)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ageOn(student.birth_date, today)} años{category ? ` · ${category.name}` : ''}
            </ThemedText>
            <Badge
              label={studentStatusLabels[student.status]}
              tone={
                student.status === 'active'
                  ? 'success'
                  : student.status === 'pending'
                    ? 'warning'
                    : 'neutral'
              }
            />
          </View>
        </View>
        <BeltBadge belt={belt} degree={progress?.degree} width={160} />
      </Card>

      {student.status === 'pending' && isStaff ? (
        <Button
          title="Aprobar ficha"
          onPress={() => setStatus('active')}
          loading={update.isPending}
        />
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title="Editar"
            variant="secondary"
            onPress={() => router.push(`/students/${student.id}/edit`)}
          />
        </View>
        <View style={styles.action}>
          <Button title="PDF" variant="secondary" onPress={handleExport} loading={exporting} />
        </View>
        {isStaff ? (
          <View style={styles.action}>
            <Button
              title="Otorgar grado"
              variant="secondary"
              onPress={() => router.push(`/students/${student.id}/rank`)}
            />
          </View>
        ) : null}
      </View>

      <Section title="Progreso">
        <StatGrid>
          <Stat label="Entrenando" value={trainingTime(student.joined_at, today)} />
          <Stat label="Clases totales" value={progress?.total_classes ?? 0} />
          <Stat label="Clases desde el último grado" value={progress?.classes_since_award ?? 0} />
          <Stat label="Última clase" value={formatDate(progress?.last_class_date)} />
        </StatGrid>
        {step ? (
          <ThemedText type="small">
            Próximo paso: {step.belt.name}
            {step.degree ? ` · ${step.degree}° grado` : ''}
          </ThemedText>
        ) : null}
        {status ? (
          <View style={styles.requirements}>
            <ThemedText type="small" themeColor={status.classesOk ? 'text' : 'textSecondary'}>
              {status.classesOk ? '✓' : '○'} Clases: {status.classes} de{' '}
              {status.requirement.min_classes}
            </ThemedText>
            <ThemedText type="small" themeColor={status.monthsOk ? 'text' : 'textSecondary'}>
              {status.monthsOk ? '✓' : '○'} Tiempo en el grado: {status.months} de{' '}
              {status.requirement.min_months} meses
            </ThemedText>
            {status.requirement.notes ? (
              <ThemedText type="small" themeColor="textSecondary">
                {status.requirement.notes}
              </ThemedText>
            ) : null}
            {status.ready ? <Badge label="Cumple los requisitos" tone="success" /> : null}
          </View>
        ) : null}
      </Section>

      <Section title="Datos personales">
        <Info label="RUT" value={student.rut} />
        <Info label="Nacimiento" value={formatDate(student.birth_date)} />
        <Info label="Teléfono" value={student.phone} />
        <Info label="Correo" value={student.email} />
        <Info label="Ingreso" value={formatDate(student.joined_at)} />
        {student.status === 'inactive' ? (
          <>
            <Info label="Baja" value={formatDate(student.left_at)} />
            <Info label="Motivo" value={student.left_reason} />
          </>
        ) : null}
      </Section>

      <Section title="Emergencia y salud">
        <Info label="Contacto" value={student.emergency_contact_name} />
        <Info label="Teléfono" value={student.emergency_contact_phone} />
        <Info label="Condiciones" value={student.medical_notes} />
      </Section>

      {student.prior_experience ? (
        <Section title="Experiencia previa">
          <ThemedText type="small">{student.prior_experience}</ThemedText>
        </Section>
      ) : null}

      <Section title="Exoneración de responsabilidad">
        {signature ? (
          <>
            <ThemedText type="small">
              Firmada el {formatDate(signature.signed_at)} por {signature.signer_name}
              {signature.signer_relationship === 'guardian' ? ' (apoderado)' : ''}.
            </ThemedText>
            <View style={styles.signature}>
              <SvgXml xml={signature.signature_svg} width="100%" height={90} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Aún no está firmada.
            </ThemedText>
            <Button
              title="Firmar ahora"
              onPress={() => router.push(`/students/${student.id}/waiver`)}
            />
          </>
        )}
      </Section>

      <Section title="Historial de grados">
        {ranks?.length ? (
          ranks.map((rank) => {
            const rankBelt = belts?.find((b) => b.id === rank.belt_id);
            return (
              <ListItem
                key={rank.id}
                title={`${rankBelt?.name ?? 'Cinturón'}${rank.degree ? ` · ${rank.degree}° grado` : ''}`}
                subtitle={[formatDate(rank.awarded_at), rank.notes].filter(Boolean).join(' · ')}
                right={
                  isStaff ? (
                    <Button
                      title="Quitar"
                      variant="ghost"
                      onPress={() =>
                        Alert.alert('Quitar grado', '¿Eliminar este registro del historial?', [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Quitar',
                            style: 'destructive',
                            onPress: () => removeRank.mutate(rank.id),
                          },
                        ])
                      }
                    />
                  ) : undefined
                }
              />
            );
          })
        ) : (
          <EmptyState message="Sin grados registrados." />
        )}
      </Section>

      <Section title="Asistencia reciente">
        {attendance?.length ? (
          attendance.map((a) => (
            <ListItem
              key={a.id}
              title={a.session?.title ?? 'Clase'}
              subtitle={formatDate(a.session?.date)}
              right={a.is_late ? <Badge label="Atraso" tone="warning" /> : undefined}
            />
          ))
        ) : (
          <EmptyState message="Aún no registra asistencia." />
        )}
      </Section>

      <Section
        title={debt ? `Pagos · debe ${formatMoney(debt)}` : 'Pagos · al día'}
        action={
          isStaff ? (
            <Button
              title="Nuevo cobro"
              variant="ghost"
              onPress={() =>
                router.push({ pathname: '/payments/new-charge', params: { student: student.id } })
              }
            />
          ) : undefined
        }>
        {isStaff ? (
          <Select
            label="Plan de pago"
            value={student.fee_plan_id}
            allowClear
            placeholder="Sin plan"
            options={(plans ?? []).map((p) => ({
              value: p.id,
              label: p.name,
              hint: `${formatMoney(p.amount)} · vence el día ${p.billing_day}`,
            }))}
            onChange={(planId) =>
              update.mutate({ id: student.id, values: { fee_plan_id: planId } })
            }
          />
        ) : null}
        {(charges ?? []).slice(0, 12).map((charge) => (
          <ListItem
            key={charge.id}
            title={charge.description || conceptLabels[charge.concept ?? 'other']}
            subtitle={`Vence ${formatDate(charge.due_date)}`}
            right={
              charge.status === 'paid' ? (
                <Badge label="Pagado" tone="success" />
              ) : charge.status === 'void' ? (
                <Badge label="Anulado" />
              ) : (
                <Badge
                  label={formatMoney(charge.remaining)}
                  tone={(charge.due_date ?? '') < today ? 'danger' : 'warning'}
                />
              )
            }
            onPress={() => router.push(`/payments/charge/${charge.id}`)}
          />
        ))}
        {charges && !charges.length ? <EmptyState message="Sin cobros." /> : null}
      </Section>

      {quizAssignments?.length ? (
        <Section title="Pruebas">
          {quizAssignments.map((a) => (
            <ListItem
              key={a.id}
              title={quizzes?.find((q) => q.id === a.quiz_id)?.title ?? 'Prueba'}
              subtitle={
                a.submitted_at ? `Respondida el ${formatDate(a.submitted_at)}` : 'Pendiente'
              }
              right={a.grade !== null ? `Nota ${String(a.grade).replace('.', ',')}` : undefined}
            />
          ))}
        </Section>
      ) : null}

      {isStaff && !student.user_id ? <LinkAccount studentId={student.id} /> : null}

      {isStaff ? (
        <Section title="Estado de la ficha">
          {student.status === 'active' ? (
            leaving ? (
              <>
                <TextField
                  label="Motivo de la baja (opcional)"
                  value={leftReason}
                  onChangeText={setLeftReason}
                />
                <Button
                  title="Confirmar baja"
                  variant="danger"
                  onPress={() => setStatus('inactive')}
                  loading={update.isPending}
                />
                <Button title="Cancelar" variant="ghost" onPress={() => setLeaving(false)} />
              </>
            ) : (
              <Button
                title="Dar de baja (se guarda el historial)"
                variant="secondary"
                onPress={() => setLeaving(true)}
              />
            )
          ) : student.status === 'inactive' ? (
            <Button title="Reactivar alumno" onPress={() => setStatus('active')} />
          ) : null}
          {isOwner ? (
            <Button title="Eliminar ficha" variant="ghost" onPress={confirmDelete} />
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.info}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.infoLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.infoValue}>
        {value || '—'}
      </ThemedText>
    </View>
  );
}

/** Vincula la ficha (cargada por el profesor) con la cuenta de un alumno que se unió a la app. */
function LinkAccount({ studentId }: { studentId: string }) {
  const { academy } = useAcademy();
  const { data: members } = useMembers(academy.id);
  const { data: students } = useStudents(academy.id);
  const link = useLinkStudentAccount();
  const [userId, setUserId] = useState<string | null>(null);

  // Alumnos con cuenta que no tienen una ficha activa vinculada.
  const linkedUsers = new Set(
    (students ?? []).filter((s) => s.user_id && s.status !== 'pending').map((s) => s.user_id),
  );
  const candidates = (members ?? []).filter(
    (m) => m.role === 'student' && m.status !== 'rejected' && !linkedUsers.has(m.user_id),
  );
  if (!candidates.length) return null;

  return (
    <Section title="Vincular con la cuenta del alumno">
      <ThemedText type="small" themeColor="textSecondary">
        Si este alumno ya creó su cuenta en la app, vincúlala para que vea su progreso y pagos. Si
        había creado una ficha propia, esa se elimina.
      </ThemedText>
      <Select
        label="Cuenta"
        value={userId}
        onChange={setUserId}
        options={candidates.map((m) => ({
          value: m.user_id,
          label: m.profile?.full_name || 'Sin nombre',
        }))}
      />
      <Button
        title="Vincular"
        disabled={!userId}
        loading={link.isPending}
        onPress={() =>
          link.mutate(
            { studentId, userId: userId! },
            { onError: (e) => Alert.alert('No se pudo vincular', errorMessage(e)) },
          )
        }
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  headerText: { flex: 1, gap: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
  requirements: { gap: Spacing.one },
  signature: { backgroundColor: '#ffffff', borderRadius: 8, padding: Spacing.one },
  info: { flexDirection: 'row', gap: Spacing.two },
  infoLabel: { width: 100 },
  infoValue: { flex: 1 },
});
