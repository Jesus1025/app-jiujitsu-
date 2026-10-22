import { Stack } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { useMyProfile, useUpdateMyProfile } from '@/features/community/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export default function ProfileScreen() {
  const profile = useMyProfile();
  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Mi perfil' }} />
      {profile.data ? (
        <ProfileForm profile={profile.data} />
      ) : (
        <QueryState isLoading={profile.isLoading} error={profile.error} onRetry={profile.refetch} />
      )}
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: Tables<'profiles'> }) {
  const { session } = useAuth();
  const update = useUpdateMyProfile();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (fullName.trim().length < 3) return setError('Ingresa tu nombre completo.');
    setError(null);
    update.mutate(
      { full_name: fullName.trim(), phone: phone.trim() || null },
      {
        onSuccess: () => {
          setMessage('Datos guardados.');
          supabase.auth.updateUser({ data: { full_name: fullName.trim() } }).catch(() => {});
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <>
      <ThemedText themeColor="textSecondary">{session?.user.email}</ThemedText>
      <TextField
        label="Nombre completo"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
      />
      <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormError message={error} />
      {message ? <ThemedText type="small">{message}</ThemedText> : null}
      <Button title="Guardar" onPress={handleSave} loading={update.isPending} />
      <ThemedText type="small" themeColor="textSecondary">
        Los datos de tu ficha de alumno (contacto de emergencia, salud, etc.) se editan desde tu
        ficha.
      </ThemedText>
    </>
  );
}
