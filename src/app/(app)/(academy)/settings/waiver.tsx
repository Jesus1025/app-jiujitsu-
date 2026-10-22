import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useActiveWaiver } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

/** Editar el texto de la exoneración. Cada cambio crea una versión nueva; las firmas antiguas se conservan. */
export default function WaiverSettingsScreen() {
  const { academy } = useAcademy();
  const waiver = useActiveWaiver(academy.id);

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Texto de la exoneración' }} />
      {waiver.isLoading ? (
        <QueryState isLoading error={null} />
      ) : (
        <WaiverEditor current={waiver.data ?? null} onSaved={() => waiver.refetch()} />
      )}
    </Screen>
  );
}

function WaiverEditor({
  current,
  onSaved,
}: {
  current: Tables<'waiver_templates'> | null;
  onSaved: () => void;
}) {
  const { academy } = useAcademy();
  const [title, setTitle] = useState(current?.title ?? 'Exoneración de responsabilidad');
  const [body, setBody] = useState(current?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!body.trim()) return setError('El texto no puede quedar vacío.');
    setError(null);
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('waiver_templates').insert({
        academy_id: academy.id,
        version: (current?.version ?? 0) + 1,
        title: title.trim(),
        body: body.trim(),
      });
      if (insertError) throw insertError;
      if (current) {
        const { error: updateError } = await supabase
          .from('waiver_templates')
          .update({ active: false })
          .eq('id', current.id);
        if (updateError) throw updateError;
      }
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        Versión actual: {current?.version ?? '—'}. Al guardar se crea una versión nueva; las firmas
        ya hechas quedan asociadas a la versión que firmaron.
      </ThemedText>
      <TextField label="Título" value={title} onChangeText={setTitle} />
      <TextField label="Texto" value={body} onChangeText={setBody} multiline style={styles.body} />
      <FormError message={error} />
      {saved ? <ThemedText type="small">Nueva versión guardada.</ThemedText> : null}
      <Button title="Guardar nueva versión" onPress={handleSave} loading={saving} />
    </>
  );
}

const styles = StyleSheet.create({
  body: { minHeight: 260, paddingTop: Spacing.two, textAlignVertical: 'top' },
});
