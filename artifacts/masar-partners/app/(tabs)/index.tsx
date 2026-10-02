import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSetPartnerAvailability } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { usePartnerJobs } from '@/lib/jobs';
import { errKey } from '@/lib/format';
import { SessionGate } from '@/components/Gate';
import { Countdown, FreshnessBanner, JobCard } from '@/components/Job';
import { Badge, Banner, Button, Card, Chip, EmptyState, Screen, SectionTitle, SwitchRow, T, Skeletons, success, warn, wrapRow } from '@/components/ui';

export default function Home() {
  const { t } = useUI();
  return (
    <SessionGate tabs title={t('tab.home')}>
      <HomeContent />
    </SessionGate>
  );
}

function HomeContent() {
  const ui = useUI();
  const c = useColors();
  const s = useSession();
  const company = s.company!;
  const jobs = usePartnerJobs();
  const setAvail = useSetPartnerAvailability();
  const [err, setErr] = useState<string | null>(null);
  const canToggle = s.canManageJobs;

  const toggle = (v: boolean) => {
    setErr(null);
    setAvail.mutate(
      { companyId: company.id, data: { available: v, expectedVersion: company.version } },
      {
        onSuccess: (updated) => { s.patchCompany(updated); success(); },
        onError: (e) => { warn(); setErr(ui.t(errKey(e))); s.refetch(); },
      },
    );
  };
  const statusTone = company.status === 'approved' ? 'green' : company.status === 'pending' ? 'gold' : 'red';
  const next = jobs.offers[0];
  const refreshing = s.isFetching || jobs.q.isFetching;

  return (
    <Screen
      tabs brand title={company.name} subtitle={ui.t('app.name')}
      onRefresh={() => { s.refetch(); void jobs.q.refetch(); }} refreshing={refreshing && !s.loading}
    >
      <FreshnessBanner isError={!!s.error || jobs.q.isError} hasData={!!s.identity} dataUpdatedAt={s.updatedAt} refetch={() => { s.refetch(); void jobs.q.refetch(); }} />
      {s.companies.length > 1 && (
        <View style={wrapRow(ui.row)}>
          {s.companies.map((x) => <Chip key={x.id} label={x.name} selected={x.id === company.id} onPress={() => s.selectCompany(x.id)} />)}
        </View>
      )}

      <Card tone="navy" style={{ gap: 14 }}>
        <View style={[ui.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
          <Badge label={ui.t(`cs.${company.status}` as never)} tone={statusTone} />
          {s.role ? <T v="cap" color="#BBD3EE">{ui.t(`role.${s.role}` as never)}</T> : null}
        </View>
        {company.status === 'approved' ? (
          <>
            <T v="title" color="#FFFBEF">{company.available ? ui.t('dash.receiving') : ui.t('dash.paused')}</T>
            <View style={{ backgroundColor: '#FFFBEF', borderRadius: 16, paddingHorizontal: 14 }}>
              <SwitchRow title={ui.t('dash.available')} body={canToggle ? ui.t('dash.availableBody') : ui.t('dash.availableLocked')}
                value={company.available} onValueChange={toggle} disabled={!canToggle || !company.active} busy={setAvail.isPending} />
            </View>
            {!company.active && <T v="small" color="#FFD866">{ui.t('dash.inactive')}</T>}
          </>
        ) : (
          <>
            <T v="h2" color="#FFFBEF">{ui.t(`cs.${company.status}.title` as never)}</T>
            <T v="small" color="#D5E3F5">{ui.t(`cs.${company.status}.body` as never)}</T>
            {company.reviewReason ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 }}>
                <T v="cap" color="#FFD866">{ui.t('dash.reviewReason')}</T>
                <T v="small" color="#FFFBEF">{company.reviewReason}</T>
              </View>
            ) : null}
          </>
        )}
      </Card>
      {err ? <Banner tone="error" icon="alert-circle" text={err} /> : null}

      {!s.approved ? (
        <>
          <Banner tone="info" text={ui.t('dash.noJobsUntilApproved')} />
          {company.status !== 'blocked' && <Button variant="gold" icon="edit-3" label={ui.t('dash.completeProfile')} onPress={() => router.push('/edit-company')} />}
        </>
      ) : jobs.q.isLoading ? (
        <Skeletons n={2} height={110} />
      ) : (
        <>
          <View style={[ui.row, { gap: 12 }]}>
            <Card style={{ flex: 1 }} onPress={() => router.push('/jobs')}>
              <T v="display" color={c.primary}>{String(jobs.offers.length)}</T>
              <T v="small" color={c.mutedForeground}>{ui.t('dash.offers')}</T>
            </Card>
            <Card style={{ flex: 1 }} onPress={() => router.push('/jobs')}>
              <T v="display" color={c.primary}>{String(jobs.active.length)}</T>
              <T v="small" color={c.mutedForeground}>{ui.t('dash.active')}</T>
            </Card>
          </View>
          {next ? (
            <>
              <SectionTitle>{ui.t('dash.nextOffer')}</SectionTitle>
              <JobCard job={next} />
              <Countdown expiresAt={next.expiresAt} />
            </>
          ) : jobs.active.length === 0 ? (
            <EmptyState icon="inbox" title={ui.t('dash.emptyTitle')} body={company.available ? ui.t('dash.emptyBody') : ui.t('dash.emptyPaused')} />
          ) : (
            <>
              <SectionTitle>{ui.t('jobs.active')}</SectionTitle>
              {jobs.active.slice(0, 3).map((j) => <JobCard key={j.id} job={j} />)}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
