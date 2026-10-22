import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListItemProps = {
  title: string;
  subtitle?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
};

/** Fila de lista: elemento a la izquierda, título/subtítulo y detalle a la derecha. */
export function ListItem({ title, subtitle, left, right, onPress }: ListItemProps) {
  const theme = useTheme();

  const content = (
    <>
      {left}
      <View style={styles.text}>
        <ThemedText numberOfLines={1}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {typeof right === 'string' ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {right}
        </ThemedText>
      ) : (
        right
      )}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
    minHeight: 48,
  },
  text: { flex: 1, gap: 2 },
});
