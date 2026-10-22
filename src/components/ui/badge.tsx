import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const theme = useTheme();
  const color = {
    neutral: theme.textSecondary,
    primary: theme.primary,
    success: theme.success,
    warning: '#B26A00',
    danger: theme.danger,
  }[tone];

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: 600 },
});
