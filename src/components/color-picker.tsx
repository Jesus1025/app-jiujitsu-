import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const palette = [
  '#1F4E9C',
  '#5B2A86',
  '#C62828',
  '#E8742A',
  '#F2C230',
  '#2E8B57',
  '#5C3A1E',
  '#111111',
  '#8E8E8E',
  '#F5F5F5',
];

type ColorPickerProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  allowNone?: boolean;
};

/** Paleta de colores con opción de escribir un código #RRGGBB. */
export function ColorPicker({ label, value, onChange, allowNone }: ColorPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.swatches}>
        {allowNone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sin color"
            onPress={() => onChange(null)}
            style={[
              styles.swatch,
              styles.none,
              { borderColor: value ? theme.border : theme.primary },
            ]}>
            <ThemedText type="small">—</ThemedText>
          </Pressable>
        ) : null}
        {palette.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Color ${color}`}
            onPress={() => onChange(color)}
            style={[
              styles.swatch,
              { backgroundColor: color, borderColor: theme.border },
              value?.toUpperCase() === color && { borderColor: theme.text, borderWidth: 3 },
            ]}
          />
        ))}
      </View>
      <TextField
        label="Código del color"
        value={value ?? ''}
        onChangeText={(text) => onChange(text.trim() ? text.trim() : null)}
        autoCapitalize="characters"
        placeholder="#1F4E9C"
        maxLength={7}
        error={value && !/^#[0-9A-Fa-f]{6}$/.test(value) ? 'Usa el formato #RRGGBB' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  none: { alignItems: 'center', justifyContent: 'center' },
});
