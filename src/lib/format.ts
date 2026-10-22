// Formatos para Chile: pesos sin decimales y fechas DD/MM/AAAA.
// Las fechas sin hora ('AAAA-MM-DD') se tratan como texto para no correrse por la zona horaria.

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

export function formatMoney(amount: number | null | undefined) {
  return money.format(amount ?? 0);
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
export function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** 'AAAA-MM-DD' → '5 de diciembre'. */
export function formatLongDate(isoDate: string | null | undefined) {
  if (!isoDate) return '—';
  const [, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return `${d} de ${monthNames[m - 1]}`;
}

/** 'AAAA-MM' → 'noviembre 2026'. */
export function formatPeriod(period: string | null | undefined) {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return `${monthNames[m - 1]} ${y}`;
}

/** Fecha y hora de un timestamp en la zona horaria de la academia. */
export function formatDateTime(timestamp: string, timeZone?: string) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(timestamp));
}

/** '19:00:00' → '19:00'. */
export function formatTime(time: string | null | undefined) {
  return time ? time.slice(0, 5) : '';
}

/** Fecha de hoy ('AAAA-MM-DD') en la zona horaria indicada. */
export function todayIn(timeZone?: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Día de la semana (0 = domingo) de una fecha 'AAAA-MM-DD'. */
export function weekdayOf(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const weekdayNames = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

/** Edad cumplida a la fecha de referencia. */
export function ageOn(birthDate: string, onDate: string) {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Meses completos entre dos fechas 'AAAA-MM-DD'. */
export function monthsBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return Math.max(months, 0);
}

/** '1 año y 3 meses', '8 meses', 'menos de un mes'. */
export function formatDuration(totalMonths: number) {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (months) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
  return parts.length ? parts.join(' y ') : 'menos de un mes';
}

/** 'DD/MM/AAAA' → 'AAAA-MM-DD' (o null si no es una fecha válida). */
export function parseDate(text: string) {
  const match = text.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** 'HH:MM' válido → 'HH:MM' normalizado, o null. */
export function parseTime(text: string) {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Texto con dígitos → entero (ej. '30.000' → 30000). */
export function parseAmount(text: string) {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

export function fullName(person: { first_name: string; last_name: string }) {
  return `${person.first_name} ${person.last_name}`;
}

/** Minutos de diferencia entre la hora de la zona y UTC en un instante dado. */
function zoneOffsetMinutes(utcMillis: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMillis));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return (asUtc - utcMillis) / 60000;
}

/** Fecha 'AAAA-MM-DD' + hora 'HH:MM' en la zona de la academia → timestamp ISO (UTC). */
export function zonedToIso(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  try {
    const offset = zoneOffsetMinutes(guess, timeZone);
    let utc = guess - offset * 60000;
    // Ajuste si justo hay cambio de horario entre la estimación y el resultado.
    const corrected = zoneOffsetMinutes(utc, timeZone);
    if (corrected !== offset) utc = guess - corrected * 60000;
    return new Date(utc).toISOString();
  } catch {
    return new Date(y, m - 1, d, h, min).toISOString();
  }
}

/** Timestamp ISO → { date: 'AAAA-MM-DD', time: 'HH:MM' } en la zona de la academia. */
export function isoToZoned(iso: string, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(iso));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      time: `${get('hour')}:${get('minute')}`,
    };
  } catch {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }
}
