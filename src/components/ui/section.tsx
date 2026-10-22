import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

type SectionProps = PropsWithChildren<{
  title: string;
  action?: ReactNode;
}>;

/** Bloque con título (y acción opcional a la derecha) dentro de una tarjeta. */
export function Section({ title, action, children }: SectionProps) {
  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        {action}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: { flexShrink: 1 },
});
