import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import { useDeleteDocument, useDocuments, useUploadDocument } from '@/features/community/api';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { signedUrl } from '@/lib/files';

/** Reglamento, manual del alumno nuevo y otros documentos de la academia. */
export default function DocumentsScreen() {
  const { academy, isStaff } = useAcademy();
  const theme = useTheme();
  const documents = useDocuments(academy.id);
  const upload = useUploadDocument(academy.id);
  const remove = useDeleteDocument(academy.id);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function open(path: string) {
    try {
      await WebBrowser.openBrowserAsync(await signedUrl(path, 600));
    } catch (e) {
      Alert.alert('No se pudo abrir', errorMessage(e));
    }
  }

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'image/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      setFile(result.assets[0]);
      if (!title) setTitle(result.assets[0].name.replace(/\.[^.]+$/, ''));
    }
  }

  function handleUpload() {
    if (!file) return setError('Elige un archivo.');
    if (!title.trim()) return setError('Ingresa un título.');
    setError(null);
    upload.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        size: file.size,
      },
      {
        onSuccess: () => {
          setFile(null);
          setTitle('');
          setDescription('');
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <Screen safeArea="bottom" refreshing={documents.isRefetching} onRefresh={documents.refetch}>
      <Stack.Screen options={{ title: 'Documentos' }} />
      <QueryState
        isLoading={documents.isLoading}
        error={documents.error}
        onRetry={documents.refetch}
      />
      {documents.data && !documents.data.length ? (
        <EmptyState message="Aún no hay documentos." />
      ) : null}
      {(documents.data ?? []).map((doc) => (
        <ListItem
          key={doc.id}
          title={doc.title}
          subtitle={doc.description ?? doc.file_name}
          left={<Ionicons name="document-text-outline" size={24} color={theme.primary} />}
          right={
            isStaff ? (
              <Button
                title="Quitar"
                variant="ghost"
                onPress={() =>
                  Alert.alert('Quitar documento', `¿Eliminar "${doc.title}"?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Quitar',
                      style: 'destructive',
                      onPress: () => remove.mutate({ id: doc.id, path: doc.file_path }),
                    },
                  ])
                }
              />
            ) : undefined
          }
          onPress={() => open(doc.file_path)}
        />
      ))}

      {isStaff ? (
        <Section title="Subir documento">
          <Button
            title={file ? `Archivo: ${file.name}` : 'Elegir archivo (PDF, Word o imagen)'}
            variant="secondary"
            onPress={pick}
          />
          <TextField
            label="Título"
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Reglamento interno"
          />
          <TextField
            label="Descripción (opcional)"
            value={description}
            onChangeText={setDescription}
          />
          <FormError message={error} />
          <Button title="Subir" onPress={handleUpload} loading={upload.isPending} />
        </Section>
      ) : null}
    </Screen>
  );
}
