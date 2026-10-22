import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tables } from '@/types/database';

type BeltBadgeProps = {
  belt: Tables<'belts'> | undefined;
  degree?: number | null;
  showLabel?: boolean;
  width?: number;
};

/** Cinturón dibujado: color, franja central (kids) y grados como franjas blancas en la punta. */
export function BeltBadge({ belt, degree = 0, showLabel = true, width = 120 }: BeltBadgeProps) {
  const theme = useTheme();
  if (!belt) {
    return showLabel ? (
      <ThemedText type="small" themeColor="textSecondary">
        Sin cinturón registrado
      </ThemedText>
    ) : null;
  }

  const height = Math.round(width / 6);
  // La punta es negra salvo en el cinturón negro, que la tiene roja.
  const tipColor = belt.color_hex.toLowerCase() === '#111111' ? '#C62828' : '#111111';
  const degrees = Math.min(degree ?? 0, belt.max_degrees);

  return (
    <View style={styles.row}>
      <View
        accessibilityLabel={`Cinturón ${belt.name}${degrees ? `, ${degrees} grados` : ''}`}
        style={[
          styles.belt,
          { width, height, backgroundColor: belt.color_hex, borderColor: theme.border },
        ]}>
        {belt.stripe_color_hex ? (
          <View
            style={[
              styles.stripe,
              { height: height / 3, top: height / 3, backgroundColor: belt.stripe_color_hex },
            ]}
          />
        ) : null}
        <View style={[styles.tip, { width: width * 0.28, backgroundColor: tipColor }]}>
          {Array.from({ length: degrees }).map((_, index) => (
            <View key={index} style={styles.degree} />
          ))}
        </View>
      </View>
      {showLabel ? (
        <ThemedText type="small">
          {belt.name}
          {degrees ? ` · ${degrees}°` : ''}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  belt: {
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  stripe: { position: 'absolute', left: 0, right: 0 },
  tip: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'stretch',
    paddingHorizontal: 2,
  },
  degree: { width: 3, backgroundColor: '#ffffff' },
});
