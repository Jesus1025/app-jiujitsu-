import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { fieldErrors, otpSchema } from '@/features/auth/schemas';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    const { data, errors } = fieldErrors(otpSchema, code.trim());
    setError(errors.form ?? null);
    if (!data) return;

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: data, type: 'email' });
    setLoading(false);
    if (error) setError(errorMessage(error));
  }

  async function handleResend() {
    setNotice(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) setError(errorMessage(error));
    else setNotice('Te enviamos un código nuevo.');
  }

  return (
    <Screen>
      <ThemedText>
        Enviamos un código de 6 dígitos a <ThemedText type="smallBold">{email}</ThemedText>.
        Ingrésalo para activar tu cuenta.
      </ThemedText>

      <TextField
        label="Código"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      <FormError message={error} />
      {notice ? <ThemedText type="small">{notice}</ThemedText> : null}

      <Button title="Confirmar" onPress={handleVerify} loading={loading} />
      <Button title="Reenviar código" variant="ghost" onPress={handleResend} />
    </Screen>
  );
}
