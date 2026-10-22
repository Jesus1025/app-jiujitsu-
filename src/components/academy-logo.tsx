import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useOptionalAcademy } from '@/features/academies/active-academy';
import { useSignedUrl } from '@/lib/files';

/** Logo y nombre de la academia activa (para el encabezado). */
export function AcademyTitle() {
  const active = useOptionalAcademy();
  const { data: logoUrl } = useSignedUrl(active?.academy.logo_path);
  if (!active) return null;

  return (
    <View style={styles.row}>
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl, cacheKey: active.academy.logo_path ?? undefined }}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={`Logo de ${active.academy.name}`}
        />
      ) : null}
      <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
        {active.academy.name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, maxWidth: 280 },
  logo: { width: 32, height: 32, borderRadius: 6 },
  name: { fontSize: 17, flexShrink: 1 },
});
