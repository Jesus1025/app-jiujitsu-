import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SignaturePadProps = {
  /** Recibe la firma como SVG completo, o null si está vacía. */
  onChange: (svg: string | null) => void;
  height?: number;
};

function toSvg(paths: string[], width: number, height: number) {
  const body = paths
    .map(
      (d) =>
        `<path d="${d}" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">${body}</svg>`;
}

/** Recuadro para firmar con el dedo. Guarda la firma como SVG (se ve igual en la app y en el PDF). */
export function SignaturePad({ onChange, height = 200 }: SignaturePadProps) {
  const theme = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [stroke, setStroke] = useState('');
  // Los gestos leen estos valores desde sus callbacks (no durante el render).
  const strokeRef = useRef('');
  const sizeRef = useRef({ width: 0, height });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const { width, height: h } = sizeRef.current;
    onChangeRef.current(paths.length ? toSvg(paths, width, h) : null);
  }, [paths]);

  // Los callbacks del gesto solo leen los refs al tocar la pantalla, nunca durante el render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        strokeRef.current = `M${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setStroke(strokeRef.current);
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        strokeRef.current += ` L${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setStroke(strokeRef.current);
      },
      onPanResponderRelease: () => {
        const finished = strokeRef.current;
        strokeRef.current = '';
        setStroke('');
        if (finished.includes('L')) setPaths((previous) => [...previous, finished]);
      },
    }),
  );

  function handleLayout(event: LayoutChangeEvent) {
    sizeRef.current = {
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    };
  }

  return (
    <View style={styles.container}>
      <View
        onLayout={handleLayout}
        style={[styles.pad, { height, borderColor: theme.border }]}
        {...responder.panHandlers}>
        <Svg width="100%" height="100%">
          {[...paths, stroke].filter(Boolean).map((d, index) => (
            <Path
              key={index}
              d={d}
              stroke="#111"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {!paths.length && !stroke ? (
          <ThemedText type="small" style={styles.placeholder} pointerEvents="none">
            Firma aquí con el dedo
          </ThemedText>
        ) : null}
      </View>
      <Button title="Borrar firma" variant="ghost" onPress={() => setPaths([])} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  pad: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  placeholder: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    color: '#888',
  },
});
