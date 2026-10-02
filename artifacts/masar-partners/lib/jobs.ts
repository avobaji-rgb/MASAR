import { useMemo } from 'react';
import { getListPartnerJobsQueryKey, useListPartnerJobs, type PartnerJob } from '@workspace/api-client-react';
import { useSession } from './session';
import { POLL_MS, STALE_MS } from './config';
import { ACTIVE_STATUSES, HISTORY_STATUSES } from './format';

export function usePartnerJobs() {
  const s = useSession();
  const companyId = s.company?.id ?? '';
  const q = useListPartnerJobs(companyId, {
    query: { queryKey: getListPartnerJobsQueryKey(companyId), enabled: !!companyId && s.approved, refetchInterval: POLL_MS, staleTime: STALE_MS, gcTime: 600000 },
  });
  const worker = s.role === 'worker';
  const lists = useMemo(() => {
    const all: PartnerJob[] = (q.data ?? []).filter((j) => (worker ? j.workerId === s.userId : true));
    const byRecent = (a: PartnerJob, b: PartnerJob) => (a.updatedAt < b.updatedAt ? 1 : -1);
    return {
      offers: worker ? [] : all.filter((j) => j.status === 'offered').sort((a, b) => (a.expiresAt > b.expiresAt ? 1 : -1)),
      active: all.filter((j) => ACTIVE_STATUSES.includes(j.status)).sort(byRecent),
      history: all.filter((j) => HISTORY_STATUSES.includes(j.status)).sort(byRecent),
    };
  }, [q.data, worker, s.userId]);
  return { q, ...lists };
}
