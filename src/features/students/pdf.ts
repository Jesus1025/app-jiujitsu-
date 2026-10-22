import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { signedUrl } from '@/lib/files';
import { ageOn, formatDate, fullName } from '@/lib/format';
import type { Tables } from '@/types/database';

import { categoryFor, studentStatusLabels, trainingTime } from './helpers';

const escape = (text: string | number | null | undefined) =>
  String(text ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function row(label: string, value: string | number | null | undefined) {
  return `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`;
}

/** Genera la ficha del alumno en PDF y abre el menú para compartirla o imprimirla. */
export async function exportStudentPdf(args: {
  academyName: string;
  student: Tables<'students'>;
  progress: Tables<'student_progress'> | undefined;
  belts: Tables<'belts'>[] | undefined;
  categories: Tables<'categories'>[] | undefined;
  ranks: Tables<'rank_awards'>[] | undefined;
  signature: Tables<'waiver_signatures'> | undefined;
  today: string;
}) {
  const { student, progress, belts } = args;
  const photo = student.photo_path
    ? await signedUrl(student.photo_path, 600).catch(() => null)
    : null;
  const belt = belts?.find((b) => b.id === progress?.belt_id);
  const category = categoryFor(student.birth_date, args.categories, args.today);

  const ranks = (args.ranks ?? [])
    .map((r) => {
      const b = belts?.find((x) => x.id === r.belt_id);
      return `<tr><td>${escape(formatDate(r.awarded_at))}</td><td>${escape(b?.name)}${
        r.degree ? ` · ${r.degree}° grado` : ''
      }</td><td>${escape(r.notes ?? '')}</td></tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; padding: 24px; }
  h1 { font-size: 22px; margin: 0; } h2 { font-size: 15px; margin: 22px 0 6px; border-bottom: 1px solid #ccc; }
  .head { display: flex; gap: 16px; align-items: center; }
  .head img { width: 96px; height: 96px; border-radius: 48px; object-fit: cover; }
  .muted { color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; width: 40%; color: #444; font-weight: 600; padding: 3px 0; }
  td { padding: 3px 0; }
  .signature svg { width: 260px; height: auto; border-bottom: 1px solid #333; }
</style></head><body>
  <p class="muted">${escape(args.academyName)} · Ficha generada el ${escape(formatDate(args.today))}</p>
  <div class="head">
    ${photo ? `<img src="${photo}" />` : ''}
    <div>
      <h1>${escape(fullName(student))}</h1>
      <div class="muted">${escape(studentStatusLabels[student.status])} · ${escape(category?.name)}</div>
    </div>
  </div>

  <h2>Datos personales</h2>
  <table>
    ${row('RUT', student.rut)}
    ${row('Fecha de nacimiento', `${formatDate(student.birth_date)} (${ageOn(student.birth_date, args.today)} años)`)}
    ${row('Teléfono', student.phone)}
    ${row('Correo', student.email)}
  </table>

  <h2>Emergencia y salud</h2>
  <table>
    ${row('Contacto de emergencia', student.emergency_contact_name)}
    ${row('Teléfono de emergencia', student.emergency_contact_phone)}
    ${row('Lesiones, alergias o condiciones', student.medical_notes)}
  </table>

  <h2>Trayectoria</h2>
  <table>
    ${row('Fecha de ingreso', formatDate(student.joined_at))}
    ${row('Tiempo entrenando', trainingTime(student.joined_at, args.today))}
    ${row('Cinturón actual', belt ? `${belt.name}${progress?.degree ? ` · ${progress.degree}° grado` : ''}` : null)}
    ${row('Clases asistidas', progress?.total_classes ?? 0)}
    ${row('Experiencia previa', student.prior_experience)}
    ${student.status === 'inactive' ? row('Fecha de baja', formatDate(student.left_at)) + row('Motivo', student.left_reason) : ''}
  </table>

  <h2>Historial de grados</h2>
  ${ranks ? `<table>${ranks}</table>` : '<p class="muted">Sin grados registrados.</p>'}

  <h2>Exoneración de responsabilidad</h2>
  ${
    args.signature
      ? `<p class="muted">Firmada el ${escape(formatDate(args.signature.signed_at))} por ${escape(args.signature.signer_name)}${
          args.signature.signer_rut ? ` (RUT ${escape(args.signature.signer_rut)})` : ''
        }${args.signature.signer_relationship === 'guardian' ? ', apoderado' : ''}.</p>
         <div class="signature">${args.signature.signature_svg}</div>`
      : '<p class="muted">Pendiente de firma.</p>'
  }
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Ficha de ${fullName(student)}`,
    UTI: 'com.adobe.pdf',
  });
}
