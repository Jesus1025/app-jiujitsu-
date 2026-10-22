import { router } from 'expo-router';

/** Vuelve a la pantalla anterior o, si se abrió directo (enlace o web), al inicio. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
