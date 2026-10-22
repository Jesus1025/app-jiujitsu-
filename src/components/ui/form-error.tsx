import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function FormError({ message }: { message?: string | null }) {
  const theme = useTheme();
  if (!message) return null;

  return (
    <ThemedText type="small" accessibilityRole="alert" style={{ color: theme.danger }}>
      {message}
    </ThemedText>
  );
}
