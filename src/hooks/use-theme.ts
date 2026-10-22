/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ThemeColor } from '@/constants/theme';
import { useOptionalAcademy } from '@/features/academies/active-academy';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Texto blanco o negro según qué se lee mejor sobre el color dado. */
function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#11181C' : '#ffffff';
}

/** Colores del tema; el color principal es el de la academia activa si lo configuró. */
export function useTheme(): Record<ThemeColor, string> {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';
  const brand = useOptionalAcademy()?.academy.primary_color;

  if (brand && /^#[0-9A-Fa-f]{6}$/.test(brand)) {
    return { ...Colors[theme], primary: brand, onPrimary: readableOn(brand) };
  }
  return Colors[theme];
}
