import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';

type PhotoPickerProps = {
  name: string;
  /** Foto ya guardada (ruta en el almacenamiento). */
  photoPath?: string | null;
  /** Foto recién tomada (uri local), aún sin subir. */
  localUri?: string | null;
  onPick: (uri: string) => void;
  required?: boolean;
};

const options: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
};

/** Foto de la ficha: tomarla con la cámara o elegirla de la galería. */
export function PhotoPicker({ name, photoPath, localUri, onPick, required }: PhotoPickerProps) {
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Sin permiso', 'Activa el permiso de cámara para tomar la foto.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(options);
    if (!result.canceled) onPick(result.assets[0].uri);
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) onPick(result.assets[0].uri);
  }

  return (
    <View style={styles.container}>
      {localUri ? (
        <Image source={{ uri: localUri }} style={styles.photo} contentFit="cover" />
      ) : (
        <Avatar name={name || '?'} photoPath={photoPath} size={96} />
      )}
      <View style={styles.actions}>
        <ThemedText type="smallBold">Foto{required ? ' (obligatoria)' : ''}</ThemedText>
        <Button title="Tomar foto" variant="secondary" onPress={takePhoto} />
        <Button title="Elegir de la galería" variant="ghost" onPress={pickFromLibrary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  photo: { width: 96, height: 96, borderRadius: 48 },
  actions: { flex: 1, gap: Spacing.one },
});
