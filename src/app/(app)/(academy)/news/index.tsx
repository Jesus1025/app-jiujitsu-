import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, QueryState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useAnnouncements, useDeleteAnnouncement } from '@/features/community/api';
import { formatDateTime } from '@/lib/format';

export default function NewsScreen() {
  const { academy, isStaff } = useAcademy();
  const [kind, setKind] = useState<'news' | 'technique'>('news');
  const news = useAnnouncements(academy.id, kind);
  const remove = useDeleteAnnouncement();

  return (
    <Screen safeArea="bottom" refreshing={news.isRefetching} onRefresh={news.refetch}>
      <Stack.Screen options={{ title: 'Noticias' }} />
      {isStaff ? (
        <Button
          title={kind === 'news' ? 'Publicar noticia' : 'Publicar técnica de la semana'}
          onPress={() => router.push({ pathname: '/news/new', params: { kind } })}
        />
      ) : null}
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'news', label: 'Noticias' },
          { value: 'technique', label: 'Técnica de la semana' },
        ]}
      />
      <QueryState isLoading={news.isLoading} error={news.error} onRetry={news.refetch} />
      {news.data && !news.data.length ? <EmptyState message="Aún no hay publicaciones." /> : null}
      {(news.data ?? []).map((item) => (
        <Card key={item.id}>
          <View>
            <ThemedText type="smallBold">{item.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(item.published_at, academy.timezone)}
            </ThemedText>
          </View>
          {item.pinned ? <Badge label="Destacada" tone="primary" /> : null}
          {isStaff && item.show_on_website ? <Badge label="También en la web" /> : null}
          {item.body ? <ThemedText type="small">{item.body}</ThemedText> : null}
          {item.video_url ? (
            <Button
              title="Ver video"
              variant="secondary"
              onPress={() => Linking.openURL(item.video_url!)}
            />
          ) : null}
          {isStaff ? (
            <Button
              title="Eliminar"
              variant="ghost"
              onPress={() =>
                Alert.alert('Eliminar publicación', '¿Seguro?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(item.id) },
                ])
              }
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
