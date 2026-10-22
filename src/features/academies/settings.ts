import { useMyMemberships } from '@/features/academies/api';
import type { Json } from '@/types/database';

/** Reglas configurables por academia (ver migración academy_settings). */
export type AcademySettings = {
  grace_days: number;
  enrollment_fee: number;
  checkin_window_minutes: number;
  adult_belt_age: number;
  instructors_can_award_ranks: boolean;
  show_ranking_to_students: boolean;
  referral_percent: number;
  require_rut: boolean;
  require_photo: boolean;
  require_emergency_contact: boolean;
};

export const defaultSettings: AcademySettings = {
  grace_days: 0,
  enrollment_fee: 0,
  checkin_window_minutes: 30,
  adult_belt_age: 16,
  instructors_can_award_ranks: true,
  show_ranking_to_students: true,
  referral_percent: 50,
  require_rut: false,
  require_photo: true,
  require_emergency_contact: true,
};

/** Combina lo guardado con los valores por defecto (ignora claves con el tipo equivocado). */
export function parseSettings(raw: Json | null | undefined): AcademySettings {
  const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const result = { ...defaultSettings };
  for (const key of Object.keys(defaultSettings) as (keyof AcademySettings)[]) {
    const value = saved[key];
    if (typeof value === typeof defaultSettings[key]) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/** Ajustes de cualquier academia en la que el usuario tenga membresía (incluso pendiente). */
export function useAcademySettings(academyId: string | undefined) {
  const { data } = useMyMemberships();
  const academy = data?.find((m) => m.academy_id === academyId)?.academy;
  return parseSettings(academy?.settings);
}
