import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SignaturePad } from '@/components/signature-pad';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { type Student, useActiveWaiver, useSignWaiver } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { ageOn, fullName, todayIn } from '@/lib/format';
import { formatRut, isValidRut } from '@/lib/rut';

type WaiverFormProps = {
  student: Student;
  /** Nombre de quien firma por defecto (el usuario conectado). */
  defaultSignerName?: string;
  onDone: () => void;
};

/** Texto de la exoneración + datos de quien firma + firma con el dedo. */
export function WaiverForm({ student, defaultSignerName, onDone }: WaiverFormProps) {
  const { data: waiver, isLoading, error, refetch } = useActiveWaiver(student.academy_id);
  const isMinor = ageOn(student.birth_date, todayIn()) < 18;
  const [signerName, setSignerName] = useState(
    isMinor ? (defaultSignerName ?? '') : fullName(student),
  );
  const [signerRut, setSignerRut] = useState(isMinor ? '' : (student.rut ?? ''));
  const [signature, setSignature] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const sign = useSignWaiver();

  if (isLoading || error || !waiver) {
    return (
      <QueryState
        isLoading={isLoading}
        error={error ?? 'No hay texto de exoneración configurado.'}
        onRetry={refetch}
      />
    );
  }

  function handleSign() {
    if (!signerName.trim()) return setFormError('Ingresa el nombre de quien firma.');
    if (signerRut.trim() && !isValidRut(signerRut)) return setFormError('El RUT no es válido.');
    if (!signature) return setFormError('Falta la firma.');
    setFormError(null);
    sign.mutate(
      {
        academy_id: student.academy_id,
        student_id: student.id,
        template_id: waiver!.id,
        signer_name: signerName.trim(),
        signer_rut: signerRut.trim() ? formatRut(signerRut) : null,
        signer_relationship: isMinor ? 'guardian' : 'self',
        signature_svg: signature,
      },
      { onSuccess: onDone, onError: (e) => setFormError(errorMessage(e)) },
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        <ThemedText type="smallBold">{waiver.title}</ThemedText>
        <ThemedText type="small">{waiver.body}</ThemedText>
      </Card>

      <ThemedText>
        {isMinor
          ? `Firma el apoderado de ${fullName(student)} (menor de edad).`
          : `Firma ${fullName(student)}.`}
      </ThemedText>
      <TextField
        label={isMinor ? 'Nombre del apoderado' : 'Nombre completo'}
        value={signerName}
        onChangeText={setSignerName}
        autoCapitalize="words"
      />
      <TextField
        label="RUT de quien firma"
        value={signerRut}
        onChangeText={setSignerRut}
        onBlur={() => signerRut.trim() && setSignerRut(formatRut(signerRut))}
        autoCapitalize="characters"
      />
      <SignaturePad onChange={setSignature} />
      <FormError message={formError} />
      <Button title="Firmar y aceptar" onPress={handleSign} loading={sign.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
});
