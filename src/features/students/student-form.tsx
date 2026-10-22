import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PhotoPicker } from '@/components/photo-picker';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FormError } from '@/components/ui/form-error';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademySettings } from '@/features/academies/settings';
import { useFeePlans } from '@/features/payments/api';
import type { Student } from '@/features/students/api';
import { genderOptions } from '@/features/students/helpers';
import { errorMessage } from '@/lib/errors';
import { formatMoney, todayIn } from '@/lib/format';
import { formatRut, isValidRut } from '@/lib/rut';

export type StudentFormValues = {
  first_name: string;
  last_name: string;
  rut: string | null;
  birth_date: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  prior_experience: string | null;
  joined_at?: string;
  fee_plan_id?: string | null;
};

type StudentFormProps = {
  academyId: string;
  /** staff: profesor; self: el propio alumno; guardian: apoderado inscribiendo a un menor. */
  mode: 'staff' | 'self' | 'guardian';
  initial?: Student;
  initialName?: string;
  submitLabel: string;
  onSave: (values: StudentFormValues, photoUri: string | null) => Promise<void>;
};

const blankToNull = (text: string) => (text.trim() ? text.trim() : null);

export function StudentForm({
  academyId,
  mode,
  initial,
  initialName,
  submitLabel,
  onSave,
}: StudentFormProps) {
  const [nameFirst, ...nameRest] = (initialName ?? '').split(' ');
  const [firstName, setFirstName] = useState(
    initial?.first_name ?? (mode === 'self' ? nameFirst : ''),
  );
  const [lastName, setLastName] = useState(
    initial?.last_name ?? (mode === 'self' ? nameRest.join(' ') : ''),
  );
  const [rut, setRut] = useState(initial?.rut ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(initial?.birth_date ?? null);
  const [gender, setGender] = useState<string>(initial?.gender ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [emergencyName, setEmergencyName] = useState(initial?.emergency_contact_name ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(initial?.emergency_contact_phone ?? '');
  const [medicalNotes, setMedicalNotes] = useState(initial?.medical_notes ?? '');
  const [priorExperience, setPriorExperience] = useState(initial?.prior_experience ?? '');
  const [joinedAt, setJoinedAt] = useState<string | null>(initial?.joined_at ?? todayIn());
  const [feePlanId, setFeePlanId] = useState<string | null>(initial?.fee_plan_id ?? null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: plans } = useFeePlans(academyId);
  const settings = useAcademySettings(academyId);

  // El profesor puede cargar fichas incompletas; alumnos y apoderados siguen las reglas de la academia.
  const strict = mode !== 'staff';
  const photoRequired = strict && settings.require_photo && !initial?.photo_path;
  const rutRequired = strict && settings.require_rut;
  const emergencyRequired = strict && settings.require_emergency_contact;

  async function handleSave() {
    const nextErrors: Record<string, string> = {};
    if (!firstName.trim()) nextErrors.firstName = 'Ingresa el nombre.';
    if (!lastName.trim()) nextErrors.lastName = 'Ingresa el apellido.';
    if (!birthDate) nextErrors.birthDate = 'Ingresa la fecha de nacimiento.';
    if (rut.trim() && !isValidRut(rut)) nextErrors.rut = 'El RUT no es válido.';
    if (rutRequired && !rut.trim()) nextErrors.rut = 'Ingresa el RUT.';
    if (!emergencyName.trim() && emergencyRequired) {
      nextErrors.emergencyName = 'Indica un contacto de emergencia.';
    }
    if (!emergencyPhone.trim() && emergencyRequired) {
      nextErrors.emergencyPhone = 'Indica el teléfono de emergencia.';
    }
    if (mode === 'staff' && !joinedAt) nextErrors.joinedAt = 'Ingresa la fecha de ingreso.';
    if (photoRequired && !photoUri) nextErrors.photo = 'La foto es obligatoria.';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) {
      setFormError('Revisa los campos marcados.');
      return;
    }

    const values: StudentFormValues = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      rut: rut.trim() ? formatRut(rut) : null,
      birth_date: birthDate!,
      gender: gender || null,
      phone: blankToNull(phone),
      email: blankToNull(email),
      emergency_contact_name: blankToNull(emergencyName),
      emergency_contact_phone: blankToNull(emergencyPhone),
      medical_notes: blankToNull(medicalNotes),
      prior_experience: blankToNull(priorExperience),
    };
    if (mode === 'staff') {
      values.joined_at = joinedAt!;
      values.fee_plan_id = feePlanId;
    }

    setSaving(true);
    try {
      await onSave(values, photoUri);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <PhotoPicker
        name={`${firstName} ${lastName}`}
        photoPath={initial?.photo_path}
        localUri={photoUri}
        onPick={setPhotoUri}
        required={photoRequired}
      />
      <FormError message={errors.photo} />

      <ThemedText type="subtitle">Datos personales</ThemedText>
      <TextField
        label="Nombre"
        value={firstName}
        onChangeText={setFirstName}
        error={errors.firstName}
        autoCapitalize="words"
      />
      <TextField
        label="Apellido"
        value={lastName}
        onChangeText={setLastName}
        error={errors.lastName}
        autoCapitalize="words"
      />
      <DateField
        label="Fecha de nacimiento"
        value={birthDate}
        onChange={setBirthDate}
        error={errors.birthDate}
      />
      <TextField
        label={rutRequired ? 'RUT' : 'RUT (opcional)'}
        value={rut}
        onChangeText={setRut}
        onBlur={() => rut.trim() && setRut(formatRut(rut))}
        error={errors.rut}
        autoCapitalize="characters"
        placeholder="12.345.678-5"
      />
      <View style={styles.field}>
        <ThemedText type="smallBold">Género (opcional)</ThemedText>
        <Segmented
          options={genderOptions.map((o) => ({ value: o.value as string, label: o.label }))}
          value={gender}
          onChange={setGender}
        />
      </View>
      <TextField
        label="Teléfono"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+56 9 1234 5678"
      />
      <TextField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <ThemedText type="subtitle">Emergencia y salud</ThemedText>
      <TextField
        label="Contacto de emergencia"
        value={emergencyName}
        onChangeText={setEmergencyName}
        error={errors.emergencyName}
        autoCapitalize="words"
      />
      <TextField
        label="Teléfono de emergencia"
        value={emergencyPhone}
        onChangeText={setEmergencyPhone}
        error={errors.emergencyPhone}
        keyboardType="phone-pad"
      />
      <TextField
        label="Lesiones, alergias o condiciones médicas"
        value={medicalNotes}
        onChangeText={setMedicalNotes}
        multiline
        style={styles.multiline}
      />

      <ThemedText type="subtitle">Experiencia</ThemedText>
      <TextField
        label="¿Entrenaba antes? ¿Dónde, cuánto tiempo y con qué cinturón?"
        value={priorExperience}
        onChangeText={setPriorExperience}
        multiline
        style={styles.multiline}
      />

      {mode === 'staff' ? (
        <>
          <ThemedText type="subtitle">Academia</ThemedText>
          <DateField
            label="Fecha de ingreso"
            value={joinedAt}
            onChange={setJoinedAt}
            error={errors.joinedAt}
          />
          <Select
            label="Plan de pago"
            value={feePlanId}
            onChange={setFeePlanId}
            allowClear
            placeholder="Sin plan (no se generan mensualidades)"
            options={(plans ?? [])
              .filter((p) => p.active || p.id === feePlanId)
              .map((p) => ({
                value: p.id,
                label: p.name,
                hint: `${formatMoney(p.amount)} · vence el día ${p.billing_day}`,
              }))}
          />
        </>
      ) : null}

      <FormError message={formError} />
      <Button title={submitLabel} onPress={handleSave} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  multiline: { minHeight: 88, paddingTop: Spacing.two, textAlignVertical: 'top' },
});
