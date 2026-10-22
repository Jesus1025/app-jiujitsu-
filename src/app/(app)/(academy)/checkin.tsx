import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { goBack } from '@/lib/navigation';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useMyStudents } from '@/features/students/api';
import { parseCheckinLink, useCheckIn } from '@/features/classes/api';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, fullName } from '@/lib/format';

type Target = { academy: string; code: string; method: 'qr' | 'nfc' };

/**
 * Marcar asistencia: escaneando el QR de la academia o abriendo el enlace del sticker NFC
 * (appjiujitsu://checkin?academy=…&code=…).
 */
export default function CheckinScreen() {
  const params = useLocalSearchParams<{ academy?: string; code?: string; method?: string }>();
  const fromLink: Target | null =
    params.academy && params.code
      ? {
          academy: params.academy,
          code: params.code,
          method: params.method === 'nfc' ? 'nfc' : 'qr',
        }
      : null;
  const [scanned, setScanned] = useState<Target | null>(null);
  const target = fromLink ?? scanned;

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Marcar asistencia' }} />
      {target ? <CheckinTarget target={target} /> : <Scanner onScan={setScanned} />}
    </Screen>
  );
}

function Scanner({ onScan }: { onScan: (target: Target) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <Card>
        <ThemedText>Para escanear el QR de la academia necesitamos usar la cámara.</ThemedText>
        <Button title="Permitir cámara" onPress={requestPermission} />
      </Card>
    );
  }

  return (
    <View style={styles.scanner}>
      <ThemedText style={styles.center}>
        Apunta la cámara al QR de asistencia de la academia.
      </ThemedText>
      <View style={styles.cameraBox}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current) return;
            const parsed = parseCheckinLink(data);
            if (!parsed) {
              setError('Ese QR no es el de asistencia de la academia.');
              return;
            }
            handled.current = true;
            onScan(parsed);
          }}
        />
      </View>
      <FormError message={error} />
    </View>
  );
}

function CheckinTarget({ target }: { target: Target }) {
  const { data: students, isLoading } = useMyStudents(target.academy);
  const checkIn = useCheckIn();
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const active = (students ?? []).filter((s) => s.status === 'active');

  function mark(studentId: string) {
    checkIn.mutate(
      { academyId: target.academy, code: target.code, studentId, method: target.method },
      {
        onSuccess: (attendance) =>
          setResults((r) => ({
            ...r,
            [studentId]: {
              ok: true,
              message: `Asistencia registrada ${formatDateTime(attendance.checked_in_at)}${
                attendance.is_late ? ' (atraso)' : ''
              }`,
            },
          })),
        onError: (e) =>
          setResults((r) => ({ ...r, [studentId]: { ok: false, message: errorMessage(e) } })),
      },
    );
  }

  if (isLoading) return null;
  if (!active.length) {
    return (
      <Card>
        <ThemedText>No tienes una ficha activa en esta academia.</ThemedText>
        <Button title="Volver" variant="secondary" onPress={() => goBack()} />
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      {active.map((student) => {
        const result = results[student.id];
        const busy = checkIn.isPending && checkIn.variables?.studentId === student.id;
        return (
          <Card key={student.id}>
            <ThemedText type="smallBold">{fullName(student)}</ThemedText>
            {result ? (
              <>
                <Badge
                  label={result.ok ? '¡Listo!' : 'No se pudo marcar'}
                  tone={result.ok ? 'success' : 'danger'}
                />
                <ThemedText type="small">{result.message}</ThemedText>
              </>
            ) : (
              <Button
                title={
                  active.length > 1 ? `Marcar a ${student.first_name}` : 'Marcar mi asistencia'
                }
                onPress={() => mark(student.id)}
                loading={busy}
              />
            )}
          </Card>
        );
      })}
      <Button title="Listo" variant="secondary" onPress={() => goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  scanner: { gap: Spacing.three },
  cameraBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  center: { textAlign: 'center' },
  list: { gap: Spacing.three },
});
