import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SwitchRowProps = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function SwitchRow({ label, hint, value, onChange }: SwitchRowProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText>{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: 2 },
});
