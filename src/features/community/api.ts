import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth';
import { removeFile, uploadFile } from '@/lib/files';
import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';

export const eventTypeLabels: Record<string, string> = {
  graduation: 'Graduación',
  seminar: 'Seminario',
  masterclass: 'Masterclass',
  competition: 'Competencia',
  other: 'Otro',
};

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export function useEvents(academyId: string, { upcomingOnly = true } = {}) {
  return useQuery({
    queryKey: ['events', academyId, upcomingOnly],
    queryFn: async () => {
      let query = supabase.from('events').select('*').eq('academy_id', academyId);
      if (upcomingOnly) {
        query = query.gte('starts_at', new Date(Date.now() - 12 * 3600 * 1000).toISOString());
      }
      const { data, error } = await query.order('starts_at').limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ['events', 'one', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'events'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('events').update(rest).eq('id', id)
        : await supabase.from('events').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useEventRegistrations(eventId: string) {
  return useQuery({
    queryKey: ['events', 'registrations', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId);
      if (error) throw error;
      return data;
    },
  });
}

export function useRegisterForEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, studentId }: { eventId: string; studentId: string }) => {
      const { error } = await supabase.rpc('register_for_event', {
        p_event: eventId,
        p_student: studentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['charges'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Noticias y técnica de la semana
// ---------------------------------------------------------------------------

export function useAnnouncements(academyId: string, kind?: 'news' | 'technique', limit = 50) {
  return useQuery({
    queryKey: ['announcements', academyId, kind ?? 'all', limit],
    queryFn: async () => {
      let query = supabase.from('announcements').select('*').eq('academy_id', academyId);
      if (kind) query = query.eq('kind', kind);
      const { data, error } = await query
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'announcements'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('announcements').update(rest).eq('id', id)
        : await supabase.from('announcements').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export function useDocuments(academyId: string) {
  return useQuery({
    queryKey: ['documents', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('academy_id', academyId)
        .order('title');
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadDocument(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      title: string;
      description?: string;
      uri: string;
      fileName: string;
      mimeType?: string;
      size?: number;
    }) => {
      const safeName = args.fileName.replace(/[^\w.-]+/g, '_');
      const path = `${academyId}/shared/documents/${Date.now()}-${safeName}`;
      await uploadFile(path, args.uri, args.mimeType);
      const { error } = await supabase.from('documents').insert({
        academy_id: academyId,
        title: args.title,
        description: args.description || null,
        file_path: path,
        file_name: args.fileName,
        mime_type: args.mimeType ?? null,
        size_bytes: args.size ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', academyId] }),
  });
}

export function useDeleteDocument(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      await removeFile(path).catch(() => {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', academyId] }),
  });
}

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------

export function useNotifications() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['notifications', session?.user.id],
    enabled: !!session,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_notifications_read');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ---------------------------------------------------------------------------
// Graduación
// ---------------------------------------------------------------------------

export function useRequirements(academyId: string) {
  return useQuery({
    queryKey: ['requirements', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graduation_requirements')
        .select('*')
        .eq('academy_id', academyId);
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveRequirement(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'graduation_requirements'>) => {
      const { error } = await supabase
        .from('graduation_requirements')
        .upsert(values, { onConflict: 'belt_id,degree' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requirements', academyId] }),
  });
}

export function useDeleteRequirement(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('graduation_requirements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requirements', academyId] }),
  });
}

// ---------------------------------------------------------------------------
// Perfil propio
// ---------------------------------------------------------------------------

export function useMyProfile() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateMyProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesUpdate<'profiles'>) => {
      const { error } = await supabase
        .from('profiles')
        .update(values)
        .eq('id', session?.user.id ?? '');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
