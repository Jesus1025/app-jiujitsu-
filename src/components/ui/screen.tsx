import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = PropsWithChildren<{
  /**
   * full: pantalla sin encabezado ni pestañas. bottom: con encabezado de navegación.
   * none: dentro de las pestañas (con encabezado y barra inferior).
   */
  safeArea?: 'full' | 'bottom' | 'none';
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

const edgesFor: Record<NonNullable<ScreenProps['safeArea']>, Edge[]> = {
  full: ['top', 'bottom'],
  bottom: ['bottom'],
  none: [],
};

/** Contenedor de pantalla: área segura, scroll, tirar para actualizar y teclado que no tapa campos. */
export function Screen({ children, safeArea = 'full', refreshing, onRefresh }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={edgesFor[safeArea]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
            ) : undefined
          }>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
