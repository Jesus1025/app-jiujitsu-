import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useSignedUrl } from '@/lib/files';

type AvatarProps = {
  name: string;
  photoPath?: string | null;
  size?: number;
};

/** Foto de la ficha (desde el almacenamiento privado) o iniciales si no tiene. */
export function Avatar({ name, photoPath, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const { data: url } = useSignedUrl(photoPath);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return (
      <Image
        source={{ uri: url, cacheKey: photoPath ?? undefined }}
        style={shape}
        contentFit="cover"
        accessibilityLabel={`Foto de ${name}`}
      />
    );
  }

  return (
    <View style={[styles.fallback, shape, { backgroundColor: theme.backgroundSelected }]}>
      <Text style={[styles.initials, { color: theme.text, fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: 700 },
});
