import React, { useState } from 'react';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { usePartnerJobs } from '@/lib/jobs';
import { errKey } from '@/lib/format';
import { SessionGate } from '@/components/Gate';
import { FreshnessBanner, JobCard } from '@/components/Job';
import { Banner, EmptyState, ErrorState, Screen, Segmented, Skeletons } from '@/components/ui';

export default function Jobs() {
  const { t } = useUI();
  return (
    <SessionGate tabs title={t('tab.jobs')}>
      <JobsContent />
    </SessionGate>
  );
}

function JobsContent() {
  const ui = useUI();
  const s = useSession();
  const jobs = usePartnerJobs();
  const worker = s.role === 'worker';
  const [seg, setSeg] = useState<'offers' | 'active' | 'history'>(worker ? 'active' : 'offers');
  const options = [
    ...(worker ? [] : [{ key: 'offers' as const, label: ui.t('jobs.offers'), badge: jobs.offers.length }]),
    { key: 'active' as const, label: ui.t('jobs.active'), badge: jobs.active.length },
    { key: 'history' as const, label: ui.t('jobs.history') },
  ];
  const list = jobs[seg];
  const empty = {
    offers: ['inbox', ui.t('jobs.noOffers'), ui.t('jobs.noOffersBody')],
    active: ['truck', ui.t('jobs.noActive'), worker ? ui.t('jobs.noActiveWorker') : ui.t('jobs.noActiveBody')],
    history: ['clock', ui.t('jobs.noHistory'), ui.t('jobs.noHistoryBody')],
  }[seg] as ['inbox', string, string];

  return (
    <Screen tabs title={ui.t('tab.jobs')} subtitle={s.company?.name} onRefresh={() => void jobs.q.refetch()} refreshing={jobs.q.isFetching && !jobs.q.isLoading}>
      {!s.approved ? (
        <EmptyState icon="lock" title={ui.t('jobs.locked')} body={ui.t('dash.noJobsUntilApproved')} />
      ) : (
        <>
          <Segmented options={options} value={seg} onChange={setSeg} />
          {worker && <Banner tone="info" text={ui.t('jobs.workerNote')} />}
          <FreshnessBanner isError={jobs.q.isError} hasData={!!jobs.q.data} dataUpdatedAt={jobs.q.dataUpdatedAt} refetch={jobs.q.refetch} />
          {jobs.q.isLoading ? <Skeletons n={3} height={110} /> : jobs.q.isError && !jobs.q.data ? (
            <ErrorState kindText={ui.t(errKey(jobs.q.error))} onRetry={() => void jobs.q.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon={empty[0]} title={empty[1]} body={empty[2]} />
          ) : list.map((j) => <JobCard key={j.id} job={j} />)}
        </>
      )}
    </Screen>
  );
}
