import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { useAcademy } from '@/features/academies/active-academy';
import { roleLabels, useMyMemberships } from '@/features/academies/api';
import { useNotifications } from '@/features/community/api';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type IconName = ComponentProps<typeof Ionicons>['name'];

function Item({
  icon,
  title,
  subtitle,
  href,
  badge,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  href: Href;
  badge?: number;
}) {
  const theme = useTheme();
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      left={<Ionicons name={icon} size={22} color={theme.primary} />}
      right={badge ? <Badge label={String(badge)} tone="danger" /> : undefined}
      onPress={() => router.push(href)}
    />
  );
}

export default function MoreScreen() {
  const { academy, role, isStaff, isOwner, memberships, setActiveAcademy } = useAcademy();
  const { data: allMemberships } = useMyMemberships();
  const { data: notifications } = useNotifications();
  const queryClient = useQueryClient();
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  const pendingRequests = (allMemberships ?? []).filter((m) => m.status === 'pending').length;

  function signOut() {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          queryClient.clear();
        },
      },
    ]);
  }

  return (
    <Screen safeArea="none">
      <Section title="Avisos">
        <Item
          icon="notifications-outline"
          title="Notificaciones"
          href="/notifications"
          badge={unread}
        />
      </Section>

      <Section title="Comunidad">
        <Item icon="newspaper-outline" title="Noticias y técnica de la semana" href="/news" />
        {isStaff ? (
          <Item icon="calendar-outline" title="Calendario y eventos" href="/calendar" />
        ) : null}
        <Item icon="trophy-outline" title="Ranking de asistencia" href="/ranking" />
        <Item icon="chatbubbles-outline" title="Muro de la academia" href="/wall" />
        <Item icon="document-text-outline" title="Reglamento y documentos" href="/documents" />
        <Item icon="school-outline" title="Pruebas" href="/quizzes" />
        <Item icon="play-circle-outline" title="Cursos en video" href="/courses" />
        <Item
          icon="pricetag-outline"
          title={isStaff ? 'Tienda e inventario' : 'Tienda'}
          href="/store"
        />
      </Section>

      {isStaff ? (
        <Section title="Gestión">
          <Item
            icon="ribbon-outline"
            title="Graduación"
            subtitle="Candidatos y requisitos"
            href="/graduation"
          />
          <Item icon="people-circle-outline" title="Miembros y solicitudes" href="/members" />
          {isOwner ? (
            <Item icon="settings-outline" title="Ajustes de la academia" href="/settings" />
          ) : null}
        </Section>
      ) : null}

      <Section title="Mi cuenta">
        <Item
          icon="person-circle-outline"
          title="Mi perfil"
          subtitle={roleLabels[role]}
          href="/profile"
        />
        {pendingRequests ? (
          <Item
            icon="hourglass-outline"
            title="Mis solicitudes pendientes"
            href="/academies/requests"
            badge={pendingRequests}
          />
        ) : null}
        {memberships.length > 1
          ? memberships
              .filter((m) => m.academy_id !== academy.id)
              .map((m) => (
                <ListItem
                  key={m.id}
                  title={`Cambiar a ${m.academy?.name}`}
                  subtitle={roleLabels[m.role]}
                  onPress={() => {
                    setActiveAcademy(m.academy_id);
                    router.replace('/');
                  }}
                />
              ))
          : null}
        <Item icon="enter-outline" title="Unirme a otra academia" href="/academies/join" />
        <Item icon="add-circle-outline" title="Crear otra academia" href="/academies/create" />
      </Section>

      <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
