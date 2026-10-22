import { Alert as NativeAlert, type AlertButton, Platform } from 'react-native';

/**
 * Igual que Alert.alert de React Native, pero también funciona en la versión web
 * (donde Alert.alert no hace nada): usa window.confirm / window.alert.
 */
function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    NativeAlert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancel = (buttons ?? []).find((b) => b.style === 'cancel');

  if (!buttons?.length || (actions.length === 1 && !cancel)) {
    window.alert(text);
    actions[0]?.onPress?.();
    return;
  }
  if (window.confirm(text)) actions[0]?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = { alert };
