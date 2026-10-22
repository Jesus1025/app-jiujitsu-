import { ageOn, formatDuration, monthsBetween } from '@/lib/format';
import type { Tables } from '@/types/database';

type Category = Tables<'categories'>;
type Belt = Tables<'belts'>;
type Requirement = Tables<'graduation_requirements'>;
type Progress = Tables<'student_progress'>;

export const studentStatusLabels = {
  pending: 'Por aprobar',
  active: 'Activo',
  inactive: 'De baja',
} as const;

export const genderOptions = [
  { value: 'F', label: 'Femenino' },
  { value: 'M', label: 'Masculino' },
  { value: 'X', label: 'Otro' },
] as const;

/** Categoría por edad según la fecha de nacimiento. */
export function categoryFor(birthDate: string, categories: Category[] | undefined, today: string) {
  const age = ageOn(birthDate, today);
  return categories?.find((c) => age >= c.min_age && (c.max_age === null || age <= c.max_age));
}

/** Los menores de 16 usan el sistema de cinturones kids (IBJJF). */
export function beltTrackFor(birthDate: string, today: string) {
  return ageOn(birthDate, today) < 16 ? 'kids' : 'adult';
}

export function trainingTime(joinedAt: string, today: string) {
  return formatDuration(monthsBetween(joinedAt, today));
}

export function beltLabel(belt: Belt | undefined, degree: number | null | undefined) {
  if (!belt) return 'Sin cinturón registrado';
  return degree ? `${belt.name} · ${degree}° grado` : belt.name;
}

/**
 * Siguiente paso de graduación: un grado más en el mismo cinturón o, si ya tiene el máximo,
 * el siguiente cinturón del mismo sistema.
 */
export function nextStep(
  progress: Progress | undefined,
  belts: Belt[] | undefined,
  track: 'adult' | 'kids',
) {
  if (!belts?.length) return null;
  const trackBelts = belts
    .filter((b) => b.track === track)
    .sort((a, b) => a.sort_order - b.sort_order);
  const current = belts.find((b) => b.id === progress?.belt_id);
  if (!current) return { belt: trackBelts[0], degree: 0 };
  const degree = progress?.degree ?? 0;
  if (degree < current.max_degrees) return { belt: current, degree: degree + 1 };
  const next = trackBelts.find((b) => b.sort_order > current.sort_order);
  return next ? { belt: next, degree: 0 } : null;
}

export type RequirementStatus = {
  requirement: Requirement;
  classes: number;
  months: number;
  classesOk: boolean;
  monthsOk: boolean;
  ready: boolean;
};

/** Cuánto le falta al alumno para el siguiente grado según los requisitos de la academia. */
export function requirementStatus(
  step: { belt: Belt; degree: number } | null,
  requirements: Requirement[] | undefined,
  progress: Progress | undefined,
  joinedAt: string,
  today: string,
): RequirementStatus | null {
  if (!step) return null;
  const requirement = requirements?.find(
    (r) => r.belt_id === step.belt.id && r.degree === step.degree,
  );
  if (!requirement) return null;
  const classes = progress?.classes_since_award ?? 0;
  const months = monthsBetween(progress?.awarded_at ?? joinedAt, today);
  const classesOk = classes >= requirement.min_classes;
  const monthsOk = months >= requirement.min_months;
  return { requirement, classes, months, classesOk, monthsOk, ready: classesOk && monthsOk };
}
