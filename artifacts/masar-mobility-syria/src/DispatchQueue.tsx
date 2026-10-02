import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { useListDispatchRequests, useUpdateDispatchRequest, useOfferDispatchRequest, useTakeoverDispatchRequest, useReleaseDispatchRequest, useReofferDispatchRequest, getListDispatchRequestsQueryKey, getListRoadsideRequestsQueryKey, type RoadsideRequest } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { PartnerCompanyAdmin, CompanyOffer } from './PartnerCompanyAdmin';
import { NewRequestAlertControls, useNewRequestAlerts } from './useNewRequestAlerts';

const nextStatus: Record<string, 'enroute' | 'arrived' | 'completed' | undefined> = {
  accepted: 'enroute', enroute: 'arrived', arrived: 'completed',
};

export function DispatchQueue({ language }: { language: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const { userId } = useAuth();
  const client = useQueryClient();
  const dispatchKey = [...getListDispatchRequestsQueryKey(), userId ?? 'signed-out'];
  const queue = useListDispatchRequests({ query: { queryKey: dispatchKey, enabled: !!userId, refetchInterval: 10000, retry: false } });
  const update = useUpdateDispatchRequest();
  const offer = useOfferDispatchRequest();
  const takeover = useTakeoverDispatchRequest();
  const release = useReleaseDispatchRequest();
  const reoffer = useReofferDispatchRequest();
  const [providerIds, setProviderIds] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [recoveryReason, setRecoveryReason] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const alerts = useNewRequestAlerts(queue.data, queue.isSuccess, 'operator', userId, language);
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: getListDispatchRequestsQueryKey() }),
    client.invalidateQueries({ queryKey: getListRoadsideRequestsQueryKey() }),
  ]);
  const change = async (item: RoadsideRequest, status: 'enroute' | 'arrived' | 'completed' | 'unavailable' | 'accepted', transportStatus?: 'confirmed' | 'unavailable') => {
    setError('');
    try {
      await update.mutateAsync({ id: item.id, data: { status, ...(transportStatus ? { transportStatus } : {}), note: note[item.id] ?? '' } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update request');
      void client.invalidateQueries({ queryKey: getListDispatchRequestsQueryKey() });
    }
  };
  const handoff = async (item: RoadsideRequest) => {
    setError('');
    try {
      await offer.mutateAsync({ id: item.id, data: { providerId: (providerIds[item.id] ?? '').trim() } });
      await client.invalidateQueries({ queryKey: getListDispatchRequestsQueryKey() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not offer request to provider');
      void client.invalidateQueries({ queryKey: getListDispatchRequestsQueryKey() });
    }
  };
  const recover = async (item: RoadsideRequest, action: 'takeover' | 'release' | 'reoffer') => {
    setError('');
    const reason = (recoveryReason[item.id] ?? '').trim();
    const providerId = (providerIds[item.id] ?? '').trim();
    if (!reason) {
      setError(ar ? 'أدخل سبب تغيير التعيين.' : 'Enter a reason for changing this assignment.');
      return;
    }
    if (action === 'reoffer' && !providerId) {
      setError(ar ? 'أدخل معرّف مقدم الخدمة الجديد.' : 'Enter the replacement provider ID.');
      return;
    }
    const confirmation = action === 'takeover'
      ? ar ? 'هل تريد استلام متابعة هذا الطلب مع الإبقاء على مقدم الخدمة والحالة الحالية؟' : 'Take over this request while preserving the current provider and service status?'
      : action === 'release'
        ? ar ? 'هل تريد إعادة هذا الطلب غير المقبول إلى قائمة الانتظار؟' : 'Release this unaccepted request back to the shared queue?'
        : ar ? 'هل تريد سحب العرض غير المجاب عنه وإرساله إلى مقدم الخدمة الجديد؟' : 'Withdraw the unanswered offer and send it to the replacement provider?';
    if (!window.confirm(confirmation)) return;
    try {
      if (action === 'takeover') await takeover.mutateAsync({ id: item.id, data: { reason, expectedUpdatedAt: item.updatedAt } });
      else if (action === 'release') await release.mutateAsync({ id: item.id, data: { reason, expectedUpdatedAt: item.updatedAt } });
      else await reoffer.mutateAsync({ id: item.id, data: { providerId, reason, expectedUpdatedAt: item.updatedAt } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not recover request assignment');
      void client.invalidateQueries({ queryKey: getListDispatchRequestsQueryKey() });
    }
  };
  const busy = update.isPending || offer.isPending || takeover.isPending || release.isPending || reoffer.isPending;
  const serviceName = (service: string) => ({
    flat: ar ? 'إطار مثقوب' : 'Flat tire',
    battery: ar ? 'البطارية' : 'Battery',
    fuel: ar ? 'وقود' : 'Fuel',
    tow: ar ? 'سحب' : 'Towing',
    lockout: ar ? 'فتح مركبة' : 'Lockout',
    ev: ar ? 'مركبة كهربائية' : 'Electric vehicle',
    other: ar ? 'أخرى' : 'Other',
  }[service] ?? service);
  return <main className="page-wrap">
    <div className="page-header"><h1>{ar ? 'لوحة توزيع المساعدة' : 'Assistance dispatch'}</h1>
      <p>{ar ? 'حدّد حساب مقدم خدمة معتمداً. لن يتم تأكيد التوفر قبل قبول مقدم الخدمة للطلب.' : 'Select a verified provider account. Availability is confirmed only when that provider accepts the offer.'}</p>
      <Link href="/bank-payments" className="button button-ghost">{ar ? 'تأكيد الحوالات المصرفية' : 'Confirm bank payments'}</Link></div>
    <PartnerCompanyAdmin language={language} />
    {error && <p role="alert" className="field-error">{error}</p>}
    <NewRequestAlertControls language={language} permission={alerts.permission} feedback={alerts.feedback} onRequestPermission={() => void alerts.requestPermission()} />
    {queue.isLoading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> :
      queue.isError ? <p role="alert">{ar ? 'غير مصرح لك بالوصول أو تعذر تحميل قائمة الطلبات.' : 'Operator access required or queue unavailable.'}</p> :
      queue.data?.length ? <div className="demo-stack">{queue.data.map(item => <article className="card demo-panel" key={item.id}>
        <h2>{serviceName(item.service)} · {item.status}</h2>
        <p dir="auto">{item.location}</p>
        <p>{ar ? 'السائق:' : 'Driver:'} {item.customerName} · <a href={`tel:${encodeURIComponent(item.customerPhone)}`}>{item.customerPhone}</a></p>
        <p>{ar ? 'المركبة:' : 'Vehicle:'} <span dir="auto">{item.vehicleMake} · {item.vehiclePlate}</span></p>
        {item.unsafe && <p role="alert" className="notice"><strong>{ar ? 'تحذير: أبلغ السائق عن مكان غير آمن.' : 'Safety warning: the driver reported being in an unsafe location.'}</strong></p>}
        {item.notes && <p dir="auto"><strong>{ar ? 'ملاحظات السائق:' : 'Driver notes:'}</strong> {item.notes}</p>}
        {item.destination && <p dir="auto"><strong>{ar ? 'وجهة السحب:' : 'Towing destination:'}</strong> {item.destination}</p>}
        {item.garage && <p dir="auto">{ar ? 'المرآب:' : 'Garage:'} {item.garage}</p>}
        {item.replacementTransport && <p>{ar ? 'النقل البديل:' : 'Replacement transport:'} {item.transportStatus}</p>}
        {item.providerName && <p>{ar ? 'مقدم الخدمة: ' : 'Provider: '}{item.providerName} · {item.status === 'offered' ? ar ? 'بانتظار الرد (فرد أو شركة)' : 'awaiting reply (individual or company)' : ar ? 'تم التأكيد' : 'acknowledged'}</p>}
        {item.recoveryReason && <p dir="auto"><strong>{ar ? 'سبب تغيير التعيين:' : 'Assignment recovery reason:'}</strong> {item.recoveryReason}</p>}
        {!item.assignedToMe && (item.operatorName || item.status !== 'pending') && <>
          <label className="form-label" htmlFor={`recovery-reason-${item.id}`}>{ar ? 'سبب استلام الطلب' : 'Reason for taking over'}</label>
          <input id={`recovery-reason-${item.id}`} className="text-input" maxLength={500} value={recoveryReason[item.id] ?? ''} onChange={e => setRecoveryReason(values => ({ ...values, [item.id]: e.target.value }))} />
          <button className="button button-ghost" style={{ marginTop: 8 }} disabled={busy} onClick={() => void recover(item, 'takeover')}>{ar ? 'استلام مع الحفاظ على الحالة' : 'Take over; preserve status'}</button>
        </>}
        {item.status === 'pending' && (!item.operatorName || item.assignedToMe) && <><label className="form-label" htmlFor={`provider-id-${item.id}`}>{ar ? 'معرّف مقدم الخدمة المعتمد' : 'Verified provider ID'}</label>
          <input id={`provider-id-${item.id}`} className="text-input" value={providerIds[item.id] ?? ''} onChange={e => setProviderIds(ids => ({ ...ids, [item.id]: e.target.value }))} placeholder={ar ? 'الرمز من صفحة مقدم الخدمة' : 'ID from provider portal'} />
          <button className="button button-navy" style={{ marginTop: 8 }} disabled={busy || !providerIds[item.id]?.trim()} onClick={() => handoff(item)}>{ar ? 'إرسال إلى مقدم الخدمة' : 'Offer to provider'}</button>
          <CompanyOffer item={item} language={language} /></>}
        {item.assignedToMe && (item.status === 'pending' || item.status === 'offered') && <>
          <label className="form-label" htmlFor={`recovery-reason-${item.id}`}>{ar ? 'سبب الإرجاع إلى قائمة الانتظار' : 'Reason for releasing or reoffering'}</label>
          <input id={`recovery-reason-${item.id}`} className="text-input" maxLength={500} value={recoveryReason[item.id] ?? ''} onChange={e => setRecoveryReason(values => ({ ...values, [item.id]: e.target.value }))} />
          {item.status === 'offered' && <>
            <label className="form-label" htmlFor={`reoffer-provider-id-${item.id}`}>{ar ? 'معرّف مقدم الخدمة البديل' : 'Replacement verified provider ID'}</label>
            <input id={`reoffer-provider-id-${item.id}`} className="text-input" value={providerIds[item.id] ?? ''} onChange={e => setProviderIds(ids => ({ ...ids, [item.id]: e.target.value }))} />
            <button className="button button-ghost" style={{ marginTop: 8 }} disabled={busy || !providerIds[item.id]?.trim()} onClick={() => void recover(item, 'reoffer')}>{ar ? 'إعادة الإرسال إلى مقدم خدمة آخر' : 'Reoffer to another provider'}</button>
          </>}
          <button className="button button-ghost" style={{ marginTop: 8 }} disabled={busy} onClick={() => void recover(item, 'release')}>{ar ? 'إرجاع إلى قائمة الانتظار' : 'Release back to queue'}</button>
        </>}
        {(!item.operatorName || item.assignedToMe) && <>
        <label className="form-label" htmlFor={`dispatch-note-${item.id}`}>{ar ? 'ملاحظة للسائق' : 'Note to driver'}</label>
        <input id={`dispatch-note-${item.id}`} className="text-input" maxLength={500} value={note[item.id] ?? item.statusNote ?? ''} onChange={e => setNote(n => ({ ...n, [item.id]: e.target.value }))} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {nextStatus[item.status] && <button className="button button-navy" disabled={busy} onClick={() => change(item, nextStatus[item.status]!)}>{ar ? ({ accepted: 'في الطريق', enroute: 'وصل', arrived: 'اكتمل', completed: 'اكتمل' }[nextStatus[item.status]!]!) : ({ accepted: 'En route', enroute: 'Arrived', arrived: 'Completed', completed: 'Completed' }[nextStatus[item.status]!]!)}</button>}
          {['pending', 'offered', 'accepted', 'enroute', 'arrived'].includes(item.status) && <button className="button button-ghost" disabled={busy} onClick={() => change(item, 'unavailable')}>{ar ? 'الخدمة غير متاحة' : 'Service unavailable'}</button>}
          {item.replacementTransport && ['accepted', 'enroute', 'arrived'].includes(item.status) && item.transportStatus === 'pending' && <>
            <button className="button button-ghost" disabled={busy} onClick={() => change(item, item.status as 'accepted' | 'enroute' | 'arrived', 'confirmed')}>{ar ? 'تأكيد النقل البديل' : 'Confirm transport'}</button>
            <button className="button button-ghost" disabled={busy} onClick={() => change(item, item.status as 'accepted' | 'enroute' | 'arrived', 'unavailable')}>{ar ? 'النقل غير متاح' : 'Transport unavailable'}</button>
          </>}
        </div>
        </>}
      </article>)}</div> : <p>{ar ? 'لا توجد طلبات تنتظر التوزيع.' : 'No requests waiting for dispatch.'}</p>}
  </main>;
}