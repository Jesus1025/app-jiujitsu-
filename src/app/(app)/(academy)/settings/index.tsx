import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AcademyTitle } from '@/components/academy-logo';
import { ColorPicker } from '@/components/color-picker';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useRegenerateJoinCode, useUpdateAcademy } from '@/features/academies/api';
import type { AcademySettings } from '@/features/academies/settings';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import { uploadFile } from '@/lib/files';
import { parseAmount } from '@/lib/format';

/** Ajustes de la academia (solo el dueño). */
export default function SettingsScreen() {
  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Ajustes de la academia' }} />
      <GeneralSection />
      <BrandSection />
      <RulesSection />
      <JoinCodeSection />
      <Section title="Más ajustes">
        <ListItem title="Categorías por edad" onPress={() => router.push('/settings/categories')} />
        <ListItem
          title="Cinturones y grados"
          subtitle="Nombres, colores y cantidad de grados"
          onPress={() => router.push('/settings/belts')}
        />
        <ListItem title="Texto de la exoneración" onPress={() => router.push('/settings/waiver')} />
        <ListItem title="Planes y valores" onPress={() => router.push('/payments/plans')} />
        <ListItem
          title="Requisitos de graduación"
          onPress={() => router.push('/graduation/requirements')}
        />
        <ListItem title="Horario de clases" onPress={() => router.push('/classes/schedule')} />
      </Section>
    </Screen>
  );
}

function GeneralSection() {
  const { academy } = useAcademy();
  const update = useUpdateAcademy(academy.id);
  const [name, setName] = useState(academy.name);
  const [tolerance, setTolerance] = useState(String(academy.late_tolerance_minutes));
  const [slug, setSlug] = useState(academy.public_slug ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const minutes = Number(tolerance);
    const cleanSlug = slug.trim().toLowerCase();
    if (name.trim().length < 2) return setError('Ingresa el nombre.');
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) {
      return setError('La tolerancia debe estar entre 0 y 120 minutos.');
    }
    if (cleanSlug && !/^[a-z0-9-]{3,50}$/.test(cleanSlug)) {
      return setError('El nombre web solo puede tener minúsculas, números y guiones (3 a 50).');
    }
    setError(null);
    setSaved(false);
    update.mutate(
      { name: name.trim(), late_tolerance_minutes: minutes, public_slug: cleanSlug || null },
      {
        onSuccess: () => setSaved(true),
        onError: (e) =>
          setError(
            (e as { code?: string }).code === '23505'
              ? 'Ese nombre web ya lo usa otra academia.'
              : errorMessage(e),
          ),
      },
    );
  }

  return (
    <Section title="General">
      <TextField label="Nombre de la academia" value={name} onChangeText={setName} />
      <TextField
        label="Tolerancia para atraso (minutos)"
        value={tolerance}
        onChangeText={setTolerance}
        keyboardType="number-pad"
      />
      <TextField
        label="Nombre web (para mostrar noticias en la página)"
        value={slug}
        onChangeText={setSlug}
        autoCapitalize="none"
        placeholder="ej: academia-jiujitsu-santiago"
      />
      <FormError message={error} />
      {saved ? <ThemedText type="small">Guardado.</ThemedText> : null}
      <Button title="Guardar" onPress={handleSave} loading={update.isPending} />
    </Section>
  );
}

/** Logo y color principal: se ven en el encabezado y en los botones de toda la app. */
function BrandSection() {
  const { academy } = useAcademy();
  const update = useUpdateAcademy(academy.id);
  const [color, setColor] = useState<string | null>(academy.primary_color);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    setError(null);
    try {
      const path = `${academy.id}/shared/branding/logo-${Date.now()}.jpg`;
      await uploadFile(path, result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      await update.mutateAsync({ logo_path: path });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function saveColor() {
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return setError('Usa el formato #RRGGBB.');
    setError(null);
    update.mutate(
      { primary_color: color ? color.toUpperCase() : null },
      { onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Section title="Logo y color">
      <AcademyTitle />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            title={academy.logo_path ? 'Cambiar logo' : 'Subir logo'}
            variant="secondary"
            onPress={pickLogo}
            loading={uploading}
          />
        </View>
        {academy.logo_path ? (
          <View style={styles.flex}>
            <Button
              title="Quitar logo"
              variant="ghost"
              onPress={() => update.mutate({ logo_path: null })}
            />
          </View>
        ) : null}
      </View>
      <ColorPicker label="Color principal" value={color} onChange={setColor} allowNone />
      <FormError message={error} />
      <Button title="Guardar color" onPress={saveColor} loading={update.isPending && !uploading} />
    </Section>
  );
}

/** Reglas propias de cada academia (lo que en el plan eran preguntas para el profesor). */
function RulesSection() {
  const { academy, settings } = useAcademy();
  const update = useUpdateAcademy(academy.id);
  const [form, setForm] = useState({
    grace_days: String(settings.grace_days),
    enrollment_fee: settings.enrollment_fee ? String(settings.enrollment_fee) : '',
    checkin_window_minutes: String(settings.checkin_window_minutes),
    adult_belt_age: String(settings.adult_belt_age),
    referral_percent: String(settings.referral_percent),
  });
  const [flags, setFlags] = useState({
    instructors_can_award_ranks: settings.instructors_can_award_ranks,
    show_ranking_to_students: settings.show_ranking_to_students,
    require_rut: settings.require_rut,
    require_photo: settings.require_photo,
    require_emergency_contact: settings.require_emergency_contact,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setField = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setFlag = (key: keyof typeof flags) => (value: boolean) =>
    setFlags((f) => ({ ...f, [key]: value }));

  function handleSave() {
    const numbers = {
      grace_days: Number(form.grace_days || 0),
      enrollment_fee: parseAmount(form.enrollment_fee) ?? 0,
      checkin_window_minutes: Number(form.checkin_window_minutes),
      adult_belt_age: Number(form.adult_belt_age),
      referral_percent: Number(form.referral_percent),
    };
    const ranges: [keyof typeof numbers, number, number, string][] = [
      ['grace_days', 0, 60, 'Los días de gracia van de 0 a 60.'],
      ['checkin_window_minutes', 0, 180, 'La ventana de asistencia va de 0 a 180 minutos.'],
      ['adult_belt_age', 10, 21, 'La edad para cinturón de adulto va de 10 a 21 años.'],
      ['referral_percent', 1, 100, 'El descuento por referido va de 1 a 100 %.'],
    ];
    for (const [key, min, max, message] of ranges) {
      const value = numbers[key];
      if (!Number.isInteger(value) || value < min || value > max) return setError(message);
    }
    setError(null);
    setSaved(false);
    const next: AcademySettings = { ...settings, ...numbers, ...flags };
    update.mutate(
      { settings: next },
      { onSuccess: () => setSaved(true), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Section title="Reglas de la academia">
      <ThemedText type="small" themeColor="textSecondary">
        Cada academia define sus propias reglas. Los cambios aplican de inmediato.
      </ThemedText>

      <ThemedText type="smallBold">Pagos</ThemedText>
      <TextField
        label="Días de gracia antes de considerar un pago atrasado"
        value={form.grace_days}
        onChangeText={setField('grace_days')}
        keyboardType="number-pad"
      />
      <TextField
        label="Matrícula que se cobra al aprobar un alumno (vacío = no se cobra)"
        value={form.enrollment_fee}
        onChangeText={setField('enrollment_fee')}
        keyboardType="number-pad"
        placeholder="Ej: 20000"
      />
      <TextField
        label="Descuento sugerido por traer a un alumno nuevo (%)"
        value={form.referral_percent}
        onChangeText={setField('referral_percent')}
        keyboardType="number-pad"
      />

      <ThemedText type="smallBold">Clases y grados</ThemedText>
      <TextField
        label="Minutos antes de la clase en que se puede marcar con el QR"
        value={form.checkin_window_minutes}
        onChangeText={setField('checkin_window_minutes')}
        keyboardType="number-pad"
      />
      <TextField
        label="Edad desde la que se usan cinturones de adulto"
        value={form.adult_belt_age}
        onChangeText={setField('adult_belt_age')}
        keyboardType="number-pad"
      />
      <SwitchRow
        label="Los instructores pueden otorgar grados"
        hint="Si lo desactivas, solo el dueño otorga cinturones y grados."
        value={flags.instructors_can_award_ranks}
        onChange={setFlag('instructors_can_award_ranks')}
      />
      <SwitchRow
        label="Los alumnos ven el ranking de asistencia"
        value={flags.show_ranking_to_students}
        onChange={setFlag('show_ranking_to_students')}
      />

      <ThemedText type="smallBold">Ficha del alumno (al inscribirse por la app)</ThemedText>
      <SwitchRow
        label="Foto obligatoria"
        value={flags.require_photo}
        onChange={setFlag('require_photo')}
      />
      <SwitchRow
        label="RUT obligatorio"
        value={flags.require_rut}
        onChange={setFlag('require_rut')}
      />
      <SwitchRow
        label="Contacto de emergencia obligatorio"
        value={flags.require_emergency_contact}
        onChange={setFlag('require_emergency_contact')}
      />

      <FormError message={error} />
      {saved ? <ThemedText type="small">Reglas guardadas.</ThemedText> : null}
      <Button title="Guardar reglas" onPress={handleSave} loading={update.isPending} />
    </Section>
  );
}

function JoinCodeSection() {
  const { academy } = useAcademy();
  const regenerate = useRegenerateJoinCode(academy.id);

  function confirmRegenerate() {
    Alert.alert(
      'Cambiar código de invitación',
      'El código actual dejará de servir para unirse. Quienes ya son miembros no se ven afectados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cambiar', onPress: () => regenerate.mutate() },
      ],
    );
  }

  return (
    <Section title="Código de invitación">
      <ThemedText type="subtitle">{academy.join_code}</ThemedText>
      <Button
        title="Cambiar código"
        variant="secondary"
        onPress={confirmRegenerate}
        loading={regenerate.isPending}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
