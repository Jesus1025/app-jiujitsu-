import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { EmptyState, QueryState } from '@/components/ui/states';
import { useMarkNotificationsRead, useNotifications } from '@/features/community/api';
import { openNotificationTarget } from '@/features/notifications/push';
import { formatDateTime } from '@/lib/format';

export default function NotificationsScreen() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const hasUnread = (notifications.data ?? []).some((n) => !n.read_at);

  // Al abrir la lista se marcan como leídas (se siguen viendo destacadas hasta salir).
  useEffect(() => {
    if (hasUnread) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  return (
    <Screen
      safeArea="bottom"
      refreshing={notifications.isRefetching}
      onRefresh={notifications.refetch}>
      <Stack.Screen options={{ title: 'Notificaciones' }} />
      <QueryState
        isLoading={notifications.isLoading}
        error={notifications.error}
        onRetry={notifications.refetch}
      />
      {notifications.data && !notifications.data.length ? (
        <EmptyState message="No tienes notificaciones." />
      ) : null}
      {(notifications.data ?? []).map((n) => (
        <ListItem
          key={n.id}
          title={n.title}
          subtitle={`${n.body ? `${n.body}\n` : ''}${formatDateTime(n.created_at)}`}
          right={!n.read_at ? <Badge label="Nueva" tone="primary" /> : undefined}
          onPress={() => openNotificationTarget(n.data as Record<string, unknown>)}
        />
      ))}
    </Screen>
  );
}
