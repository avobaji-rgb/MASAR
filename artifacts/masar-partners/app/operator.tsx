import React, { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListDispatchRequestsQueryKey, getListPartnerAuditQueryKey, getListPartnerReviewsQueryKey,
  useListDispatchRequests, useListEligiblePartnerCompanies, useListPartnerAudit, useListPartnerReviews,
  useOfferPartnerJob, useReviewPartnerCompany, getListEligiblePartnerCompaniesQueryKey,
  type PartnerCompany, type RoadsideRequest,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { POLL_MS, STALE_MS } from '@/lib/config';
import { errKey } from '@/lib/format';
import { FreshnessBanner, serviceLabel } from '@/components/Job';
import { Badge, Banner, Button, Card, Chip, EmptyState, ErrorState, Field, KV, Screen, Segmented, Skeletons, T, success, warn, wrapRow } from '@/components/ui';

type Seg = 'reviews' | 'dispatch' | 'audit';

export default function Operator() {
  const ui = useUI();
  const s = useSession();
  const [seg, setSeg] = useState<Seg>('reviews');
  if (!s.identity) return <Screen onBack title={ui.t('op.title')}><Skeletons n={2} /></Screen>;
  if (!s.operator) return <Screen onBack title={ui.t('op.title')}><Banner tone="warn" text={ui.t('err.forbidden')} /></Screen>;
  return (
    <Screen onBack title={ui.t('op.title')}>
      <Segmented value={seg} onChange={setSeg} options={[
        { key: 'reviews', label: ui.t('op.reviews') }, { key: 'dispatch', label: ui.t('op.dispatch') }, { key: 'audit', label: ui.t('op.audit') },
      ]} />
      {seg === 'reviews' ? <Reviews /> : seg === 'dispatch' ? <Dispatch /> : <Audit />}
    </Screen>
  );
}

function Reviews() {
  const ui = useUI();
  const qc = useQueryClient();
  const q = useListPartnerReviews({ query: { queryKey: getListPartnerReviewsQueryKey(), refetchInterval: POLL_MS, staleTime: STALE_MS } });
  const review = useReviewPartnerCompany();
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const act = (co: PartnerCompany, status: 'approved' | 'rejected' | 'blocked') => {
    setErr(null);
    if (status !== 'approved' && !reason.trim()) { setErr(ui.t('op.reasonRequired')); return; }
    review.mutate({ companyId: co.id, data: { status, reason: reason.trim(), expectedVersion: co.version } }, {
      onSuccess: () => { success(); setOpen(null); setReason(''); void qc.invalidateQueries({ queryKey: getListPartnerReviewsQueryKey() }); void qc.invalidateQueries({ queryKey: getListPartnerAuditQueryKey() }); },
      onError: (e) => { warn(); setErr(ui.t(errKey(e))); void q.refetch(); },
    });
  };
  if (q.isLoading) return <Skeletons n={3} height={110} />;
  if (!q.data) return <ErrorState kindText={ui.t(errKey(q.error))} onRetry={() => void q.refetch()} />;
  return (
    <View style={{ gap: 12 }}>
      <FreshnessBanner isError={q.isError} hasData dataUpdatedAt={q.dataUpdatedAt} refetch={q.refetch} />
      {q.data.length === 0 ? <EmptyState icon="check-circle" title={ui.t('op.noReviews')} /> : q.data.map((co) => (
        <Card key={co.id} onPress={open === co.id ? undefined : () => { setOpen(co.id); setReason(''); setErr(null); }}>
          <View style={[ui.row, { justifyContent: 'space-between', gap: 8, alignItems: 'center' }]}>
            <T v="h2" style={{ flex: 1 }}>{co.name}</T>
            <Badge label={ui.t(`cs.${co.status}` as never)} tone={co.status === 'approved' ? 'green' : co.status === 'pending' ? 'gold' : 'red'} />
          </View>
          <KV k={ui.t('form.phone')} v={co.phone} ltr />
          <KV k={ui.t('form.contact')} v={co.contact} />
          <KV k={ui.t('form.address')} v={`${co.address}, ${co.area}, ${co.city}`} />
          <KV k={ui.t('form.hours')} v={co.hours} />
          <KV k={ui.t('form.services')} v={co.services.join(', ')} />
          <KV k={ui.t('op.docs')} v={String(co.documents.length)} />
          {co.reviewReason ? <KV k={ui.t('dash.reviewReason')} v={co.reviewReason} /> : null}
          {open === co.id && (
            <View style={{ gap: 10 }}>
              {err ? <Banner tone="error" icon="alert-circle" text={err} /> : null}
              <Field label={ui.t('op.reason')} value={reason} onChangeText={setReason} multiline maxLength={1000} />
              <Button variant="gold" icon="check" label={ui.t('op.approve')} onPress={() => act(co, 'approved')} loading={review.isPending} />
              <Button variant="ghost" icon="x" label={ui.t('op.reject')} onPress={() => act(co, 'rejected')} disabled={review.isPending} />
              <Button variant="danger" icon="slash" label={ui.t('op.block')} onPress={() => act(co, 'blocked')} disabled={review.isPending} />
              <Button variant="ghost" label={ui.t('common.cancel')} onPress={() => setOpen(null)} />
            </View>
          )}
        </Card>
      ))}
    </View>
  );
}

function Dispatch() {
  const ui = useUI();
  const q = useListDispatchRequests({ query: { queryKey: getListDispatchRequestsQueryKey(), refetchInterval: POLL_MS, staleTime: STALE_MS } });
  const [sel, setSel] = useState<RoadsideRequest | null>(null);
  if (sel) return <OfferFlow request={sel} onDone={() => { setSel(null); void q.refetch(); }} onCancel={() => setSel(null)} />;
  if (q.isLoading) return <Skeletons n={3} height={100} />;
  if (!q.data) return <ErrorState kindText={ui.t(errKey(q.error))} onRetry={() => void q.refetch()} />;
  return (
    <View style={{ gap: 12 }}>
      <FreshnessBanner isError={q.isError} hasData dataUpdatedAt={q.dataUpdatedAt} refetch={q.refetch} />
      {q.data.length === 0 ? <EmptyState icon="inbox" title={ui.t('op.noRequests')} /> : q.data.map((r) => (
        <Card key={r.id} onPress={() => setSel(r)}>
          <View style={[ui.row, { justifyContent: 'space-between', gap: 8 }]}>
            <T v="h2" style={{ flex: 1 }}>{serviceLabel(ui.t, r.service)}</T>
            <Badge label={r.status} tone="navy" />
          </View>
          <T v="small">{r.location}</T>
          <T v="cap">{ui.fmt(r.updatedAt)}</T>
        </Card>
      ))}
    </View>
  );
}

function OfferFlow({ request, onDone, onCancel }: { request: RoadsideRequest; onDone: () => void; onCancel: () => void }) {
  const ui = useUI();
  const c = useColors();
  const qc = useQueryClient();
  const q = useListEligiblePartnerCompanies(request.id, { query: { queryKey: getListEligiblePartnerCompaniesQueryKey(request.id), staleTime: 0 } });
  const offer = useOfferPartnerJob();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [secs, setSecs] = useState(600);
  const [err, setErr] = useState<string | null>(null);
  const send = () => {
    if (!companyId) return;
    setErr(null);
    offer.mutate({ requestId: request.id, data: { companyId, expectedUpdatedAt: request.updatedAt, expiresInSeconds: secs } }, {
      onSuccess: () => { success(); void qc.invalidateQueries({ queryKey: getListPartnerAuditQueryKey() }); onDone(); },
      onError: (e) => { warn(); setErr(ui.t(errKey(e))); },
    });
  };
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <T v="h2">{serviceLabel(ui.t, request.service)}</T>
        <T v="small">{request.location}</T>
      </Card>
      {err ? <Banner tone="error" icon="alert-circle" text={err} /> : null}
      <T v="label" color={c.mutedForeground}>{ui.t('op.eligible')}</T>
      {q.isLoading ? <Skeletons n={2} height={70} /> : !q.data ? <ErrorState kindText={ui.t(errKey(q.error))} onRetry={() => void q.refetch()} /> :
        q.data.length === 0 ? <EmptyState icon="users" title={ui.t('op.noEligible')} /> : (
          <View style={{ gap: 8 }}>
            {q.data.map((co) => <Chip key={co.id} label={`${co.name} - ${co.city}`} selected={companyId === co.id} onPress={() => setCompanyId(co.id)} />)}
          </View>
        )}
      <T v="label" color={c.mutedForeground}>{ui.t('op.expiresIn')}</T>
      <View style={wrapRow(ui.row)}>
        {[300, 600, 900].map((n) => <Chip key={n} label={ui.t('op.minutes', { n: n / 60 })} selected={secs === n} onPress={() => setSecs(n)} />)}
      </View>
      <Button variant="gold" icon="send" label={ui.t('op.sendOffer')} onPress={send} loading={offer.isPending} disabled={!companyId} />
      <Button variant="ghost" label={ui.t('common.cancel')} onPress={onCancel} />
    </View>
  );
}

function Audit() {
  const ui = useUI();
  const c = useColors();
  const q = useListPartnerAudit({ query: { queryKey: getListPartnerAuditQueryKey(), refetchInterval: POLL_MS, staleTime: STALE_MS } });
  if (q.isLoading) return <Skeletons n={4} height={70} />;
  if (!q.data) return <ErrorState kindText={ui.t(errKey(q.error))} onRetry={() => void q.refetch()} />;
  if (q.data.length === 0) return <EmptyState icon="list" title={ui.t('op.noAudit')} />;
  return (
    <View style={{ gap: 10 }}>
      <FreshnessBanner isError={q.isError} hasData dataUpdatedAt={q.dataUpdatedAt} refetch={q.refetch} />
      {q.data.map((a) => (
        <Card key={a.id} entering={false}>
          <T v="body" w="bold">{a.action}</T>
          {a.details ? <T v="small">{a.details}</T> : null}
          <T v="cap" color={c.mutedForeground}>{ui.fmt(a.createdAt)}</T>
          <T v="cap" color={c.mutedForeground} style={{ writingDirection: 'ltr' }}>{a.actorId}</T>
        </Card>
      ))}
    </View>
  );
}
