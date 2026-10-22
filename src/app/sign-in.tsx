import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { fieldErrors, signInSchema } from '@/features/auth/schemas';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    const { data, errors } = fieldErrors(signInSchema, { email: email.trim(), password });
    setErrors(errors);
    setFormError(null);
    if (!data) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(data);
    setLoading(false);
    // Si sale bien, el layout raíz detecta la sesión y cambia de pantalla solo.
    if (error) setFormError(errorMessage(error));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">App Jiu-Jitsu</ThemedText>
        <ThemedText themeColor="textSecondary">Gestión de tu academia en un solo lugar.</ThemedText>
      </View>

      <TextField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSignIn}
      />
      <FormError message={formError} />

      <Button title="Entrar" onPress={handleSignIn} loading={loading} />

      <View style={styles.links}>
        <Link href="/forgot-password">
          <ThemedText type="linkPrimary">¿Olvidaste tu contraseña?</ThemedText>
        </Link>
        <Link href="/sign-up">
          <ThemedText type="linkPrimary">¿No tienes cuenta? Créala aquí</ThemedText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    marginTop: Spacing.six,
    marginBottom: Spacing.four,
  },
  links: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
