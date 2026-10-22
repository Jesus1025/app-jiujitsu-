import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption<T extends string> = { value: T; label: string; hint?: string };

type SelectProps<T extends string> = {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  searchable?: boolean;
};

/** Campo de selección que abre una lista a pantalla completa (con búsqueda opcional). */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seleccionar',
  allowClear,
  searchable,
}: SelectProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function choose(next: T | null) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <ThemedText
          style={styles.flex}
          themeColor={selected ? 'text' : 'textSecondary'}
          numberOfLines={1}>
          {selected?.label ?? placeholder}
        </ThemedText>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">{label}</ThemedText>
            {searchable ? (
              <TextField label="Buscar" value={query} onChangeText={setQuery} autoFocus />
            ) : null}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(item.value)}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor: theme.border },
                  (pressed || item.value === value) && {
                    backgroundColor: theme.backgroundSelected,
                  },
                ]}>
                <View style={styles.flex}>
                  <ThemedText>{item.label}</ThemedText>
                  {item.hint ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.hint}
                    </ThemedText>
                  ) : null}
                </View>
                {item.value === value ? (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            )}
          />
          <View style={styles.footer}>
            {allowClear && value ? (
              <Button title="Quitar selección" variant="secondary" onPress={() => choose(null)} />
            ) : null}
            <Button title="Cerrar" variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  flex: { flex: 1 },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modalHeader: { padding: Spacing.three, gap: Spacing.three },
  list: { paddingHorizontal: Spacing.three },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  footer: { padding: Spacing.three, gap: Spacing.two },
});
