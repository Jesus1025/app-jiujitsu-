import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { type MemberRole, roleLabels, useJoinAcademy } from '@/features/academies/api';

const joinableRoles: { role: MemberRole; hint: string }[] = [
  { role: 'student', hint: 'Entreno en la academia' },
  { role: 'guardian', hint: 'Inscribo a mi hijo o hija' },
  { role: 'instructor', hint: 'Hago clases en la academia' },
];

export default function JoinAcademyScreen() {
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
        onSuccess: () => router.back(),
        onError: (e) =>
          setError(
            (e as { code?: string }).code === 'P0002'
              ? 'No encontramos una academia con ese código.'
              : 'No pudimos enviar la solicitud. Intenta de nuevo.',
          ),
      },
    );
  }

  return (
    <Screen>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  roles: { gap: Spacing.two },
});
