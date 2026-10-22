import { Stack } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { QueryState } from '@/components/ui/states';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useCheckinCode, useRotateCheckinCode } from '@/features/academies/api';
import { checkinLink } from '@/features/classes/api';
import { errorMessage } from '@/lib/errors';

/** QR para que los alumnos marquen asistencia. Se puede imprimir o mostrar en una tablet. */
export default function CheckinQrScreen() {
  const { academy, settings } = useAcademy();
  const { data: code, isLoading, error, refetch } = useCheckinCode(academy.id);
  const rotate = useRotateCheckinCode(academy.id);

  function confirmRotate() {
    Alert.alert(
      'Cambiar código',
      'El QR y los stickers NFC actuales dejarán de funcionar. Úsalo si alguien está marcando asistencia sin estar en la academia.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'destructive',
          onPress: () =>
            rotate.mutate(undefined, {
              onError: (e) => Alert.alert('No se pudo cambiar', errorMessage(e)),
            }),
        },
      ],
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'QR de asistencia' }} />
      {code ? (
        <>
          <View style={styles.qr}>
            <QRCode value={checkinLink(academy.id, code)} size={260} quietZone={12} />
          </View>
          <ThemedText style={styles.center}>
            Los alumnos lo escanean desde la app ({'"'}Marcar asistencia{'"'}) al llegar a clases.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Funciona desde {settings.checkin_window_minutes} minutos antes de cada clase hasta que
            termina. Si llegan después de la tolerancia ({academy.late_tolerance_minutes} min),
            queda como atraso.
          </ThemedText>

          <Section title="Sticker NFC (opcional)">
            <ThemedText type="small">
              Graba este enlace en un sticker NFC con una app como {'"'}NFC Tools{'"'} y pégalo en
              la entrada: al acercar el teléfono se abre la app y marca la asistencia.
            </ThemedText>
            <Button
              title="Compartir enlace para el sticker"
              variant="secondary"
              onPress={() => Share.share({ message: checkinLink(academy.id, code, 'nfc') })}
            />
          </Section>

          <Button
            title="Cambiar código"
            variant="ghost"
            onPress={confirmRotate}
            loading={rotate.isPending}
          />
        </>
      ) : (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qr: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    padding: Spacing.two,
    borderRadius: 16,
  },
  center: { textAlign: 'center' },
});
