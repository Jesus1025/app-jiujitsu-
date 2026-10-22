import { shareTextFile } from '@/lib/files';
import { ageOn, formatDate, fullName } from '@/lib/format';
import type { Tables } from '@/types/database';

import { categoryFor, studentStatusLabels } from './helpers';

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Lista de alumnos en CSV (separado por ; para que Excel en español lo abra en columnas). */
export async function exportStudentsCsv(args: {
  academyName: string;
  students: Tables<'students'>[];
  progress: Map<string, Tables<'student_progress'>> | undefined;
  balances: Map<string, Tables<'student_balances'>> | undefined;
  belts: Tables<'belts'>[] | undefined;
  categories: Tables<'categories'>[] | undefined;
  today: string;
}) {
  const header = [
    'Nombre',
    'RUT',
    'Fecha de nacimiento',
    'Edad',
    'Categoría',
    'Estado',
    'Fecha de ingreso',
    'Cinturón',
    'Grado',
    'Clases totales',
    'Teléfono',
    'Correo',
    'Contacto de emergencia',
    'Teléfono de emergencia',
    'Notas médicas',
    'Deuda',
  ];

  const rows = args.students.map((s) => {
    const p = args.progress?.get(s.id);
    const belt = args.belts?.find((b) => b.id === p?.belt_id);
    return [
      fullName(s),
      s.rut,
      formatDate(s.birth_date),
      ageOn(s.birth_date, args.today),
      categoryFor(s.birth_date, args.categories, args.today)?.name,
      studentStatusLabels[s.status],
      formatDate(s.joined_at),
      belt?.name,
      p?.degree,
      p?.total_classes ?? 0,
      s.phone,
      s.email,
      s.emergency_contact_name,
      s.emergency_contact_phone,
      s.medical_notes,
      args.balances?.get(s.id)?.pending_amount ?? 0,
    ];
  });

  // BOM para que Excel reconozca las tildes (UTF-8).
  const content =
    '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
  const safeName = args.academyName.replace(/[^\w]+/g, '-').toLowerCase();
  await shareTextFile(`alumnos-${safeName}-${args.today}.csv`, content, 'text/csv');
}
