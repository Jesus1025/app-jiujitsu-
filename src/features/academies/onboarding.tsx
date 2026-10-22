import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import {
  type MemberRole,
  roleLabels,
  useCreateAcademy,
  useJoinAcademy,
  useMyMemberships,
} from '@/features/academies/api';
import { useMyStudents, useSignedStudentIds } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { fullName } from '@/lib/format';

/** Las rutas de la ficha existen en dos lugares: en el onboarding y dentro de una academia. */
export type FlowBase = 'onboarding' | 'academies';

function goToStudentForm(base: FlowBase, academyId: string, mode: 'self' | 'guardian') {
  const params = { academy: academyId, mode };
  if (base === 'onboarding') router.push({ pathname: '/onboarding/student-form', params });
  else router.push({ pathname: '/academies/student-form', params });
}

function goToWaiver(base: FlowBase, studentId: string) {
  const params = { student: studentId };
  if (base === 'onboarding') router.push({ pathname: '/onboarding/waiver', params });
  else router.push({ pathname: '/academies/waiver', params });
}

const joinableRoles: { role: MemberRole; hint: string }[] = [
  { role: 'student', hint: 'Entreno en la academia' },
  { role: 'guardian', hint: 'Inscribo a mi hijo o hija' },
  { role: 'instructor', hint: 'Hago clases en la academia' },
];

export function JoinAcademyForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [role, setRole] = useState<MemberRole>('student');
  const [error, setError] = useState<string | null>(null);
  const joinAcademy = useJoinAcademy();

  function handleJoin() {
    if (code.trim().length !== 6) {
      setError('El código tiene 6 caracteres.');
      return;
    }
    setError(null);
    joinAcademy.mutate(
      { code: code.trim(), role },
      {
        onSuccess: onDone,
        onError: (e) =>
          setError(
            (e as { code?: string }).code === 'P0002'
              ? 'No encontramos una academia con ese código.'
              : errorMessage(e),
          ),
      },
    );
  }

  return (
    <View style={styles.stack}>
      <ThemedText themeColor="textSecondary">
        Pídele el código de 6 caracteres a tu profesor. Tu solicitud quedará pendiente hasta que la
        apruebe.
      </ThemedText>
      <TextField
        label="Código de la academia"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        placeholder="Ej: K7PQ2M"
      />
      <View style={styles.roles}>
        <ThemedText type="smallBold">Me uno como</ThemedText>
        {joinableRoles.map((option) => (
          <Button
            key={option.role}
            title={`${roleLabels[option.role]} · ${option.hint}`}
            variant={role === option.role ? 'primary' : 'secondary'}
            onPress={() => setRole(option.role)}
          />
        ))}
      </View>
      <FormError message={error} />
      <Button title="Enviar solicitud" onPress={handleJoin} loading={joinAcademy.isPending} />
    </View>
  );
}

export function CreateAcademyForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createAcademy = useCreateAcademy();

  function handleCreate() {
    if (name.trim().length < 2) {
      setError('Ingresa el nombre de la academia.');
      return;
    }
    setError(null);
    createAcademy.mutate(name.trim(), {
      onSuccess: onDone,
      onError: (e) => setError(errorMessage(e)),
    });
  }

  return (
    <View style={styles.stack}>
      <ThemedText themeColor="textSecondary">
        Quedarás como dueño. Se crean automáticamente las categorías por edad, los cinturones de
        Jiu-Jitsu, un plan de mensualidad y el texto de exoneración; podrás ajustarlos después.
      </ThemedText>
      <TextField
        label="Nombre de la academia"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Academia Jiu-Jitsu Santiago"
        autoCapitalize="words"
        onSubmitEditing={handleCreate}
      />
      <FormError message={error} />
      <Button title="Crear academia" onPress={handleCreate} loading={createAcademy.isPending} />
    </View>
  );
}

/**
 * Solicitudes pendientes del usuario con los pasos que le faltan:
 * completar la ficha (o las de sus hijos) y firmar la exoneración.
 */
export function PendingRequests({ base }: { base: FlowBase }) {
  const { data: memberships, refetch, isRefetching } = useMyMemberships();
  const { data: myStudents } = useMyStudents(undefined);
  const studentIds = (myStudents ?? []).map((s) => s.id);
  const { data: signed } = useSignedStudentIds(studentIds);
  const pending = (memberships ?? []).filter((m) => m.status === 'pending');

  if (!pending.length) return null;

  return (
    <View style={styles.stack}>
      {pending.map((m) => {
        const records = (myStudents ?? []).filter((s) => s.academy_id === m.academy_id);
        const ownRecord = records.find((s) => s.user_id);
        const children = records.filter((s) => !s.user_id);
        return (
          <Card key={m.id}>
            <ThemedText type="smallBold">Solicitud enviada a {m.academy?.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Como {roleLabels[m.role].toLowerCase()}. Mientras el profesor la revisa, completa
              estos pasos.
            </ThemedText>

            {m.role === 'student' ? (
              ownRecord ? (
                <ListItem
                  title="Tu ficha"
                  subtitle={
                    signed?.has(ownRecord.id) ? 'Completa y firmada' : 'Falta firmar la exoneración'
                  }
                  right={
                    signed?.has(ownRecord.id) ? <Badge label="Lista" tone="success" /> : undefined
                  }
                  onPress={
                    signed?.has(ownRecord.id) ? undefined : () => goToWaiver(base, ownRecord.id)
                  }
                />
              ) : (
                <Button
                  title="Completar mi ficha"
                  onPress={() => goToStudentForm(base, m.academy_id, 'self')}
                />
              )
            ) : null}

            {m.role === 'guardian' ? (
              <>
                {children.map((child) => (
                  <ListItem
                    key={child.id}
                    title={fullName(child)}
                    subtitle={
                      signed?.has(child.id)
                        ? 'Ficha completa y firmada'
                        : 'Falta firmar la exoneración'
                    }
                    right={
                      signed?.has(child.id) ? <Badge label="Lista" tone="success" /> : undefined
                    }
                    onPress={signed?.has(child.id) ? undefined : () => goToWaiver(base, child.id)}
                  />
                ))}
                <Button
                  title={
                    children.length ? 'Agregar otro hijo o hija' : 'Inscribir a mi hijo o hija'
                  }
                  variant={children.length ? 'secondary' : 'primary'}
                  onPress={() => goToStudentForm(base, m.academy_id, 'guardian')}
                />
              </>
            ) : null}

            <Button
              title="Revisar si ya me aprobaron"
              variant="ghost"
              onPress={() => refetch()}
              loading={isRefetching}
            />
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  roles: { gap: Spacing.two },
});
