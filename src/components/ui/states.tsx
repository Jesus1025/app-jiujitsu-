import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';

export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <ThemedText style={styles.text}>{errorMessage(error)}</ThemedText>
      {onRetry ? <Button title="Reintentar" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
      {message}
    </ThemedText>
  );
}

/** Muestra carga o error de una consulta; si todo está bien, devuelve null. */
export function QueryState({
  isLoading,
  error,
  onRetry,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
}) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return null;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  text: { textAlign: 'center' },
});
