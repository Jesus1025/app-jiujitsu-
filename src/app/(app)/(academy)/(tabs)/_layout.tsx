import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useAcademy } from '@/features/academies/active-academy';
import { useNotifications } from '@/features/community/api';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

/** Pestañas distintas para el staff (gestión) y para alumnos/apoderados. */
export default function TabsLayout() {
  const theme = useTheme();
  const { isStaff, academy } = useAcademy();
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  const staffOnly = isStaff ? undefined : null;
  const memberOnly = isStaff ? null : undefined;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        headerTitleAlign: 'left',
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', headerTitle: academy.name, tabBarIcon: icon('home-outline') }}
      />
      <Tabs.Screen
        name="students"
        options={{ title: 'Alumnos', href: staffOnly, tabBarIcon: icon('people-outline') }}
      />
      <Tabs.Screen
        name="classes"
        options={{ title: 'Clases', href: staffOnly, tabBarIcon: icon('calendar-outline') }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progreso', href: memberOnly, tabBarIcon: icon('ribbon-outline') }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendario', href: memberOnly, tabBarIcon: icon('calendar-outline') }}
      />
      <Tabs.Screen
        name="payments"
        options={{ title: 'Pagos', tabBarIcon: icon('wallet-outline') }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Más',
          tabBarIcon: icon('menu-outline'),
          tabBarBadge: unread ? unread : undefined,
        }}
      />
    </Tabs>
  );
}
