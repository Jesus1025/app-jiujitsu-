import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useSaveAnnouncement } from '@/features/community/api';
import { errorMessage } from '@/lib/errors';

/** Publicar una noticia (ofertas, competencias…) o la técnica de la semana. Notifica a todos. */
export default function NewAnnouncementScreen() {
  const params = useLocalSearchParams<{ kind?: 'news' | 'technique' }>();
  const { academy } = useAcademy();
  const save = useSaveAnnouncement();
  const [kind, setKind] = useState<'news' | 'technique'>(params.kind ?? 'news');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [pinned, setPinned] = useState(false);
  const [onWebsite, setOnWebsite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) return setError('Ingresa un título.');
    setError(null);
    save.mutate(
      {
        academy_id: academy.id,
        kind,
        title: title.trim(),
        body: body.trim(),
        video_url: videoUrl.trim() || null,
        pinned,
        show_on_website: kind === 'news' && onWebsite,
      },
      { onSuccess: () => router.back(), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Nueva publicación' }} />
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'news', label: 'Noticia' },
          { value: 'technique', label: 'Técnica de la semana' },
        ]}
      />
      <TextField
        label="Título"
        value={title}
        onChangeText={setTitle}
        placeholder={kind === 'news' ? 'Ej: Promo noviembre' : 'Ej: Raspada de tijera'}
      />
      <TextField
        label="Texto"
        value={body}
        onChangeText={setBody}
        multiline
        style={styles.multiline}
        placeholder={
          kind === 'news'
            ? 'Ej: Si traes a un alumno nuevo que pague matrícula y mensualidad en noviembre, pagas la mitad de tu mensualidad.'
            : 'Qué vamos a trabajar esta semana, detalles clave…'
        }
      />
      <TextField
        label="Enlace a video (opcional)"
        value={videoUrl}
        onChangeText={setVideoUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      <SwitchRow label="Destacar arriba" value={pinned} onChange={setPinned} />
      {kind === 'news' ? (
        <SwitchRow
          label="Mostrar también en la página web"
          hint="Requiere configurar el nombre web en Ajustes de la academia."
          value={onWebsite}
          onChange={setOnWebsite}
        />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        Todos los miembros de la academia recibirán una notificación.
      </ThemedText>
      <FormError message={error} />
      <Button title="Publicar" onPress={handleSave} loading={save.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 120, paddingTop: Spacing.two, textAlignVertical: 'top' },
});
