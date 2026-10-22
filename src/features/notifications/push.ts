import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Mostrar las notificaciones también con la app abierta.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Abre la pantalla relacionada con una notificación (según los datos que trae). */
export function openNotificationTarget(data: Record<string, unknown> | null | undefined) {
  if (!data) return;
  if (typeof data.event_id === 'string') {
    router.push({ pathname: '/events/[id]', params: { id: data.event_id } });
  } else if (typeof data.charge_id === 'string') {
    router.push({ pathname: '/payments/charge/[id]', params: { id: data.charge_id } });
  } else if (typeof data.quiz_id === 'string') {
    router.push('/quizzes');
  } else if (typeof data.course_id === 'string') {
    router.push({ pathname: '/courses/[id]', params: { id: data.course_id } });
  } else if (typeof data.announcement_id === 'string') {
    router.push('/news');
  } else if (typeof data.membership_id === 'string') {
    router.push('/members');
  } else if (typeof data.student_id === 'string') {
    router.push({ pathname: '/students/[id]', params: { id: data.student_id } });
  }
}

async function registerToken(userId: string) {
  // Las notificaciones push necesitan un teléfono real y un proyecto EAS (ver README).
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
  if (!projectId) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const status = current.granted
    ? current.status
    : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase
    .from('push_tokens')
    .upsert({
      token,
      user_id: userId,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    });
}

/** Registra el teléfono para recibir push y abre la pantalla correcta al tocar una notificación. */
export function usePushRegistration() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    registerToken(userId).catch(() => {
      // Sin push la app sigue funcionando: las notificaciones se ven dentro de la app.
    });
  }, [userId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationTarget(response.notification.request.content.data);
    });
    return () => subscription.remove();
  }, []);
}
