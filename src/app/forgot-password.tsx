import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { emailSchema, fieldErrors, resetPasswordSchema } from '@/features/auth/schemas';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

// Recuperación con código de 6 dígitos (no con enlace), para no depender de deep links.
export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    const { data, errors } = fieldErrors(emailSchema, email.trim());
    setErrors(errors.form ? { email: errors.form } : {});
    setFormError(null);
    if (!data) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data);
    setLoading(false);
    if (error) setFormError(errorMessage(error));
    else setStep('code');
  }

  async function handleReset() {
    const { data, errors } = fieldErrors(resetPasswordSchema, { code: code.trim(), password });
    setErrors(errors);
    setFormError(null);
    if (!data) return;

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: data.code,
      type: 'recovery',
    });
    if (verifyError) {
      setLoading(false);
      setFormError(errorMessage(verifyError));
      return;
    }
    // verifyOtp ya inició sesión; el cambio de contraseña sigue aunque la pantalla cambie.
    const { error } = await supabase.auth.updateUser({ password: data.password });
    setLoading(false);
    if (error) setFormError(errorMessage(error));
  }

  if (step === 'email') {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          Ingresa tu correo y te enviaremos un código para crear una contraseña nueva.
        </ThemedText>
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
        <FormError message={formError} />
        <Button title="Enviar código" onPress={handleSendCode} loading={loading} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText>
        Revisa tu correo <ThemedText type="smallBold">{email.trim()}</ThemedText> e ingresa el
        código.
      </ThemedText>
      <TextField
        label="Código"
        value={code}
        onChangeText={setCode}
        error={errors.code}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      <TextField
        label="Nueva contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormError message={formError} />
      <Button title="Cambiar contraseña" onPress={handleReset} loading={loading} />
      <Button title="Usar otro correo" variant="ghost" onPress={() => setStep('email')} />
    </Screen>
  );
}
