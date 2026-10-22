import { Stack } from 'expo-router';
import { useState } from 'react';

import { Alert } from '@/lib/alert';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { EmptyState, QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import { useCreatePost, useDeletePost, usePosts } from '@/features/content/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/** Muro de la academia: comentarios y testimonios que quedan en el tiempo. */
export default function WallScreen() {
  const { academy, isStaff } = useAcademy();
  const { session } = useAuth();
  const posts = usePosts(academy.id);
  const create = useCreatePost(academy.id);
  const remove = useDeletePost(academy.id);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handlePost() {
    if (!body.trim()) return;
    setError(null);
    create.mutate(body.trim(), {
      onSuccess: () => setBody(''),
      onError: (e) => setError(errorMessage(e)),
    });
  }

  return (
    <Screen safeArea="bottom" refreshing={posts.isRefetching} onRefresh={posts.refetch}>
      <Stack.Screen options={{ title: 'Muro' }} />
      <TextField
        label="¿Qué te pareció la clase? Comparte con la academia"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
      />
      <FormError message={error} />
      <Button
        title="Publicar"
        onPress={handlePost}
        loading={create.isPending}
        disabled={!body.trim()}
      />
      <QueryState isLoading={posts.isLoading} error={posts.error} onRetry={posts.refetch} />
      {posts.data && !posts.data.length ? (
        <EmptyState message="Sé el primero en escribir." />
      ) : null}
      {(posts.data ?? []).map((post) => (
        <Card key={post.id}>
          <ThemedText type="smallBold">{post.author_name || 'Miembro'}</ThemedText>
          <ThemedText>{post.body}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateTime(post.created_at, academy.timezone)}
          </ThemedText>
          {isStaff || post.author_id === session?.user.id ? (
            <Button
              title="Eliminar"
              variant="ghost"
              onPress={() =>
                Alert.alert('Eliminar publicación', '¿Seguro?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(post.id) },
                ])
              }
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
