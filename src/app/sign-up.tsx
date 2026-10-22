import { router } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { fieldErrors, signUpSchema } from '@/features/auth/schemas';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    const { data, errors } = fieldErrors(signUpSchema, { fullName, email: email.trim(), password });
    setErrors(errors);
    setFormError(null);
    if (!data) return;

    setLoading(true);
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.fullName } },
    });
    setLoading(false);

    if (error) {
      setFormError(errorMessage(error));
      return;
    }
    // Con confirmación de correo activada no hay sesión todavía: se pide el código.
    if (!result.session) {
      router.push({ pathname: '/verify-email', params: { email: data.email } });
    }
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Crea tu cuenta. Después podrás crear tu academia o unirte a una con su código.
      </ThemedText>

      <TextField
        label="Nombre completo"
        value={fullName}
        onChangeText={setFullName}
        error={errors.fullName}
        autoComplete="name"
        textContentType="name"
      />
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormError message={formError} />

      <Button title="Crear cuenta" onPress={handleSignUp} loading={loading} />
    </Screen>
  );
}
