import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useCategories, useDeleteCategory, useSaveCategory } from '@/features/academies/api';
import { errorMessage } from '@/lib/errors';
import type { Tables } from '@/types/database';

/** Categorías por edad: se asignan solas a cada alumno según su fecha de nacimiento. */
export default function CategoriesScreen() {
  const { academy } = useAcademy();
  const { data: categories } = useCategories(academy.id);
  const [adding, setAdding] = useState(false);

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Categorías por edad' }} />
      {(categories ?? []).map((c) => (
        <CategoryEditor key={c.id} category={c} />
      ))}
      {adding ? (
        <CategoryEditor nextOrder={(categories?.length ?? 0) + 1} onDone={() => setAdding(false)} />
      ) : (
        <Button title="Agregar categoría" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}

function CategoryEditor({
  category,
  nextOrder,
  onDone,
}: {
  category?: Tables<'categories'>;
  nextOrder?: number;
  onDone?: () => void;
}) {
  const { academy } = useAcademy();
  const save = useSaveCategory(academy.id);
  const remove = useDeleteCategory(academy.id);
  const [name, setName] = useState(category?.name ?? '');
  const [minAge, setMinAge] = useState(category ? String(category.min_age) : '');
  const [maxAge, setMaxAge] = useState(category?.max_age != null ? String(category.max_age) : '');
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const min = Number(minAge);
    const max = maxAge.trim() ? Number(maxAge) : null;
    if (!name.trim()) return setError('Ingresa el nombre.');
    if (!Number.isInteger(min) || min < 0) return setError('Edad mínima inválida.');
    if (max !== null && (!Number.isInteger(max) || max < min))
      return setError('Edad máxima inválida.');
    setError(null);
    save.mutate(
      {
        id: category?.id,
        academy_id: academy.id,
        name: name.trim(),
        min_age: min,
        max_age: max,
        sort_order: category?.sort_order ?? nextOrder ?? 0,
      },
      { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Section title={category?.name ?? 'Nueva categoría'}>
      <TextField label="Nombre" value={name} onChangeText={setName} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Desde (años)"
            value={minAge}
            onChangeText={setMinAge}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Hasta (vacío = sin límite)"
            value={maxAge}
            onChangeText={setMaxAge}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <FormError message={error} />
      <Button title="Guardar" onPress={handleSave} loading={save.isPending} />
      {category ? (
        <Button
          title="Eliminar"
          variant="ghost"
          onPress={() =>
            Alert.alert('Eliminar categoría', `¿Eliminar "${category.name}"?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(category.id) },
            ])
          }
        />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
