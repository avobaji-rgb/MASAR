import React, { useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPartnerJobQueryKey, getListPartnerJobsQueryKey, getListPartnerMembersQueryKey, useGetPartnerJob, useListPartnerMembers,
  useRespondPartnerOffer, useUpdatePartnerJob, type PartnerJob,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { POLL_MS, STALE_MS } from '@/lib/config';
import { errKey, nextStatus, stepGroup, stepKey } from '@/lib/format';
import { Countdown, FreshnessBanner, serviceLabel, statusTone, useCountdown } from '@/components/Job';
import { Badge, Banner, Button, Card, Chip, ErrorState, Field, KV, Screen, SectionTitle, Skeletons, T, success, warn, wrapRow } from '@/components/ui';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = decodeURIComponent(String(id ?? ''));
  const ui = useUI();
  const s = useSession();
  const q = useGetPartnerJob(jobId, { query: { queryKey: getGetPartnerJobQueryKey(jobId), enabled: !!jobId, refetchInterval: POLL_MS, staleTime: STALE_MS } });
  if (q.isLoading) return <Screen onBack title={ui.t('job.title')}><Skeletons n={3} height={120} /></Screen>;
  if (!q.data) return <Screen onBack title={ui.t('job.title')}><ErrorState kindText={ui.t(errKey(q.error))} onRetry={() => void q.refetch()} /></Screen>;
  const job = q.data;
  const role = s.roleFor(job.companyId);
  if (!role || (role === 'worker' && job.workerId !== s.userId)) {
    return <Screen onBack title={ui.t('job.title')}><Banner tone="warn" text={ui.t('job.noAccess')} /></Screen>;
  }
  return <Detail job={job} role={role} q={q} />;
}

function Detail({ job, role, q }: { job: PartnerJob; role: 'owner' | 'planner' | 'worker'; q: { isError: boolean; dataUpdatedAt: number; refetch: () => unknown; isFetching: boolean } }) {
  const ui = useUI();
  const c = useColors();
  const s = useSession();
  const qc = useQueryClient();
  const respond = useRespondPartnerOffer();
  const update = useUpdatePartnerJob();
  const manager = role === 'owner' || role === 'planner';
  const members = useListPartnerMembers(job.companyId, { query: { queryKey: getListPartnerMembersQueryKey(job.companyId), enabled: manager && job.status === 'accepted', staleTime: STALE_MS } });
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [worker, setWorker] = useState<string | undefined>(undefined);
  const cd = useCountdown(job.expiresAt);
  const next = nextStatus(job.status, job.service);
  const group = stepGroup(job.service);
  const steps = group === 'other' ? ['accepted', 'arrived', 'completed'] : ['accepted', 'enroute', 'arrived', 'completed'];
  const idx = steps.indexOf(job.status);
  const isOffer = job.status === 'offered';
  const live = ['accepted', 'enroute', 'arrived'].includes(job.status);
  const showCustomer = !isOffer;

  const applied = (updated: PartnerJob) => {
    qc.setQueryData(getGetPartnerJobQueryKey(job.id), updated);
    void qc.invalidateQueries({ queryKey: getListPartnerJobsQueryKey(job.companyId) });
  };
  const fail = (e: unknown) => {
    warn();
    setErr(ui.t(errKey(e)));
    void q.refetch();
    void qc.invalidateQueries({ queryKey: getListPartnerJobsQueryKey(job.companyId) });
  };
  const decide = (decision: 'accept' | 'decline') => {
    setErr(null);
    respond.mutate({ jobId: job.id, data: { decision, expectedVersion: job.version } }, {
      onSuccess: (u) => { applied(u as PartnerJob); success(); },
      onError: fail,
    });
  };
  const advance = (status: 'accepted' | 'enroute' | 'arrived' | 'completed' | 'unavailable', assignmentOnly = false) => {
    setErr(null);
    update.mutate({ jobId: job.id, data: { status, expectedVersion: job.version, ...(note.trim() ? { note: note.trim() } : {}), ...(worker && manager ? { workerId: worker } : {}) } }, {
      onSuccess: (u) => { applied(u as PartnerJob); if (assignmentOnly) setWorker(undefined); setNote(''); success(); },
      onError: fail,
    });
  };
  const confirmUnavailable = () => {
    if (Platform.OS === 'web') { advance('unavailable'); return; }
    Alert.alert(ui.t('job.unavailable'), ui.t('job.unavailableBody'), [
      { text: ui.t('common.cancel'), style: 'cancel' },
      { text: ui.t('job.unavailable'), style: 'destructive', onPress: () => advance('unavailable') },
    ]);
  };
  const busy = respond.isPending || update.isPending;
  const workers = (members.data ?? []).filter((m) => m.active);

  return (
    <Screen onBack title={serviceLabel(ui.t, job.service)} subtitle={ui.t('job.title')} onRefresh={() => void q.refetch()} refreshing={q.isFetching}>
      <FreshnessBanner isError={q.isError} hasData dataUpdatedAt={q.dataUpdatedAt} refetch={q.refetch} />
      <View style={[ui.row, { gap: 8, alignItems: 'center' }]}>
        <Badge label={ui.t(`st.${job.status}` as never)} tone={statusTone(job.status)} />
        {isOffer && <Countdown expiresAt={job.expiresAt} />}
      </View>
      {err ? <Banner tone="error" icon="alert-circle" text={err} /> : null}

      {(live || job.status === 'completed') && (
        <Card>
          <SectionTitle>{ui.t('job.progress')}</SectionTitle>
          {steps.map((st, i) => {
            const done = i <= idx;
            const cur = i === idx;
            return (
              <View key={st} style={[ui.row, { gap: 12, alignItems: 'center', minHeight: 40 }]}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? (cur ? c.gold : c.primary) : c.muted, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="cap" w="bold" color={done ? c.primaryForeground : c.mutedForeground} style={{ textAlign: 'center', lineHeight: 16 }}>{String(i + 1)}</T>
                </View>
                <T v="body" w={cur ? 'bold' : 'regular'} color={done ? c.foreground : c.mutedForeground}>{ui.t(stepKey(job.service, st))}</T>
              </View>
            );
          })}
          <T v="cap" color={c.mutedForeground}>{ui.t(`grp.${group}` as never)}</T>
        </Card>
      )}

      <Card>
        <KV k={ui.t('job.location')} v={job.location} />
        {job.destination ? <KV k={ui.t('job.destination')} v={job.destination} /> : null}
        <KV k={ui.t('job.vehicle')} v={job.vehicleMake} />
        <KV k={ui.t('job.plate')} v={job.vehiclePlate} ltr />
        {job.notes ? <KV k={ui.t('job.notes')} v={job.notes} /> : null}
        <KV k={ui.t('job.offeredAt')} v={ui.fmt(job.offeredAt)} />
        <KV k={ui.t('job.expiresAt')} v={ui.fmt(job.expiresAt)} />
        {job.acceptedAt ? <KV k={ui.t('job.acceptedAt')} v={ui.fmt(job.acceptedAt)} /> : null}
      </Card>

      {showCustomer ? (
        <Card>
          <KV k={ui.t('job.customer')} v={job.customerName} />
          <KV k={ui.t('job.phone')} v={job.customerPhone} ltr />
          {live && job.customerPhone ? <Button variant="ghost" icon="phone" label={ui.t('job.call')} onPress={() => void Linking.openURL(`tel:${job.customerPhone}`).catch(() => {})} /> : null}
        </Card>
      ) : <Banner tone="info" icon="eye-off" text={ui.t('job.hiddenUntilAccepted')} />}

      {isOffer && manager && (
        <View style={{ gap: 10 }}>
          {cd.expired && <Banner tone="warn" text={ui.t('job.offerExpired')} />}
          <Button variant="gold" icon="check" label={ui.t('offer.accept')} onPress={() => decide('accept')} loading={respond.isPending} disabled={busy || cd.expired} />
          <Button variant="ghost" icon="x" label={ui.t('offer.decline')} onPress={() => decide('decline')} disabled={busy || cd.expired} />
          <T v="cap" color={c.mutedForeground}>{ui.t('offer.serverNote')}</T>
        </View>
      )}
      {isOffer && !manager && <Banner tone="info" text={ui.t('job.managersRespond')} />}

      {live && (
        <View style={{ gap: 12 }}>
          {manager && job.status === 'accepted' && (members.data ?? []).length > 0 && (
            <>
              <SectionTitle>{ui.t('job.assign')}</SectionTitle>
              <View style={wrapRow(ui.row)}>
                {workers.map((m) => <Chip key={m.id} label={m.name || m.userId.slice(0, 10)} selected={(worker ?? job.workerId) === m.userId} onPress={() => setWorker(m.userId)} />)}
              </View>
              {worker && worker !== job.workerId && (
                <Button variant="ghost" icon="check" label={ui.t('job.assign')} onPress={() => advance('accepted', true)} loading={update.isPending} disabled={busy} />
              )}
            </>
          )}
          {job.workerId && <T v="cap" color={c.mutedForeground}>{job.workerId === s.userId ? ui.t('job.assignedToYou') : ui.t('job.assignedOther')}</T>}
          <Field label={ui.t('job.note')} value={note} onChangeText={setNote} multiline maxLength={1000} />
          {next && <Button variant="gold" icon="arrow-right" label={ui.t(stepKey(job.service, next))} onPress={() => advance(next)} loading={update.isPending} disabled={busy} />}
          <Button variant="ghost" icon="slash" label={ui.t('job.unavailable')} onPress={confirmUnavailable} disabled={busy} />
        </View>
      )}
    </Screen>
  );
}
