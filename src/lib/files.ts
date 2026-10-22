import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { supabase } from '@/lib/supabase';

export const BUCKET = 'academy';

/** Sube un archivo local (uri de la cámara, galería o selector de documentos) al bucket privado. */
export async function uploadFile(path: string, localUri: string, contentType?: string) {
  const body = await new File(localUri).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export async function removeFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function signedUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** URL temporal (1 hora) para mostrar una imagen o abrir un documento privado. */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: () => signedUrl(path!),
  });
}

/** Escribe un texto en un archivo temporal y abre el menú de compartir (WhatsApp, correo, etc.). */
export async function shareTextFile(fileName: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}
