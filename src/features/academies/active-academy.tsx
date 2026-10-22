import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import {
  type ActiveAcademyInfo,
  type MemberRole,
  type MyMembership,
  pickActiveMembership,
  useMyMemberships,
} from '@/features/academies/api';
import { type AcademySettings, parseSettings } from '@/features/academies/settings';

const STORAGE_KEY = 'active-academy-id';

type ActiveAcademyState = {
  membership: MyMembership;
  academy: ActiveAcademyInfo;
  role: MemberRole;
  isStaff: boolean;
  isOwner: boolean;
  /** Reglas de la academia, con sus valores por defecto. */
  settings: AcademySettings;
  /** Membresías activas (para cambiar de academia). */
  memberships: MyMembership[];
  setActiveAcademy: (academyId: string) => void;
};

const ActiveAcademyContext = createContext<ActiveAcademyState | null>(null);

/** Expone la academia con la que el usuario está trabajando ahora. */
export function ActiveAcademyProvider({ children }: PropsWithChildren) {
  const { data } = useMyMemberships();
  const [preferredId, setPreferredId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(setPreferredId)
      .catch(() => {});
  }, []);

  const membership = pickActiveMembership(data, preferredId);

  function setActiveAcademy(academyId: string) {
    setPreferredId(academyId);
    AsyncStorage.setItem(STORAGE_KEY, academyId).catch(() => {});
  }

  const value: ActiveAcademyState | null =
    membership && membership.academy
      ? {
          membership,
          academy: membership.academy,
          role: membership.role,
          isStaff: membership.role === 'owner' || membership.role === 'instructor',
          isOwner: membership.role === 'owner',
          settings: parseSettings(membership.academy.settings),
          memberships: (data ?? []).filter((m) => m.status === 'active'),
          setActiveAcademy,
        }
      : null;

  return <ActiveAcademyContext.Provider value={value}>{children}</ActiveAcademyContext.Provider>;
}

/** Academia activa. Solo se usa dentro de las rutas que exigen una academia. */
export function useAcademy() {
  const value = useContext(ActiveAcademyContext);
  if (!value) throw new Error('useAcademy se usó fuera de una academia activa');
  return value;
}

export function useOptionalAcademy() {
  return useContext(ActiveAcademyContext);
}
