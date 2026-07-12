import { createContext, useContext, useMemo } from 'react';
import type { Person, PersonId } from '../types';
import { t } from '../lib/i18n';

interface MembersCtx {
  members: Person[];
  getMember: (id: PersonId) => Person;
}

const Ctx = createContext<MembersCtx | null>(null);

export function MembersProvider({ members, children }: { members: Person[]; children: React.ReactNode }) {
  const value = useMemo<MembersCtx>(() => {
    const map = new Map(members.map((m) => [m.id, m]));
    const unknown: Person = { id: '?', name: t('未知', 'Unknown'), role: '', hue: 60 };
    return { members, getMember: (id) => map.get(id) ?? unknown };
  }, [members]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMembers(): MembersCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMembers must be used within MembersProvider');
  return ctx;
}
