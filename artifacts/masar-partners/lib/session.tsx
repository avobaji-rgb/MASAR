import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGetPartnerCompanyQueryKey,
  getGetPartnerIdentityQueryKey,
  useGetPartnerIdentity,
  type PartnerCompany,
  type PartnerIdentity,
  type PartnerMemberRole,
} from '@workspace/api-client-react';
import { useAuthState } from './auth';
import { API_BASE, POLL_MS, STALE_MS } from './config';

type Role = PartnerMemberRole;
type Session = {
  userId: string | null;
  identity: PartnerIdentity | undefined;
  loading: boolean;
  error: unknown;
  refetch: () => void;
  isFetching: boolean;
  updatedAt: number;
  companies: PartnerCompany[];
  company: PartnerCompany | undefined;
  selectCompany: (id: string) => void;
  role: Role | undefined;
  roleFor: (companyId: string) => Role | undefined;
  operator: boolean;
  approved: boolean;
  canManageJobs: boolean;
  isOwner: boolean;
  patchCompany: (c: PartnerCompany) => void;
};
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn } = useAuthState();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  if (prev.current !== userId) {
    if (prev.current !== undefined) qc.clear();
    prev.current = userId;
  }
  return (
    <Ctx.Provider value={null}>
      <Inner key={userId ?? 'anon'} enabled={!!isSignedIn && !!API_BASE} userId={userId}>
        {children}
      </Inner>
    </Ctx.Provider>
  );
}

function Inner({ enabled, userId, children }: { enabled: boolean; userId: string | null; children: React.ReactNode }) {
  const qc = useQueryClient();
  const q = useGetPartnerIdentity({
    query: { queryKey: getGetPartnerIdentityQueryKey(), enabled, refetchInterval: POLL_MS, staleTime: STALE_MS, gcTime: 600000 },
  });
  const identity = q.data;
  const [selected, setSelected] = useState<string | null>(null);
  const storeKey = userId ? `masar.company.${userId}` : null;
  useEffect(() => {
    if (storeKey) AsyncStorage.getItem(storeKey).then((v) => v && setSelected(v)).catch(() => {});
  }, [storeKey]);
  const selectCompany = useCallback(
    (id: string) => {
      setSelected(id);
      if (storeKey) AsyncStorage.setItem(storeKey, id).catch(() => {});
    },
    [storeKey],
  );
  const companies = useMemo(() => identity?.companies ?? [], [identity]);
  const company = companies.find((c) => c.id === selected) ?? companies[0];
  const roleFor = useCallback(
    (companyId: string): Role | undefined => {
      if (!identity) return undefined;
      const c = identity.companies.find((x) => x.id === companyId);
      if (c && c.ownerId === identity.userId) return 'owner';
      return identity.memberships.find((m) => m.companyId === companyId && m.userId === identity.userId && m.active)?.role;
    },
    [identity],
  );
  const role = company ? roleFor(company.id) : undefined;
  const patchCompany = useCallback(
    (c: PartnerCompany) => {
      qc.setQueryData(getGetPartnerCompanyQueryKey(c.id), c);
      qc.setQueryData<PartnerIdentity>(getGetPartnerIdentityQueryKey(), (old) =>
        old ? { ...old, companies: old.companies.map((x) => (x.id === c.id ? c : x)) } : old,
      );
    },
    [qc],
  );
  const approved = !!company && company.status === 'approved' && company.active;
  const value: Session = {
    userId,
    identity,
    loading: enabled && q.isLoading,
    error: q.error,
    refetch: () => void q.refetch(),
    isFetching: q.isFetching,
    updatedAt: q.dataUpdatedAt,
    companies,
    company,
    selectCompany,
    role,
    roleFor,
    operator: !!identity?.operator,
    approved,
    canManageJobs: approved && (role === 'owner' || role === 'planner'),
    isOwner: role === 'owner',
    patchCompany,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}
