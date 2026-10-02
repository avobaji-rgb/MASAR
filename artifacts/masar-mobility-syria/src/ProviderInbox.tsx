import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetProviderIdentity, useListProviderRequests, useRespondProviderRequest, getGetProviderIdentityQueryKey, getListProviderRequestsQueryKey, getListRoadsideRequestsQueryKey } from '@workspace/api-client-react';
import { NewRequestAlertControls, useNewRequestAlerts } from './useNewRequestAlerts';

export function ProviderInbox({ language }: { language: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const { userId } = useAuth();
  const client = useQueryClient();
  const identity = useGetProviderIdentity({ query: { queryKey: [...getGetProviderIdentityQueryKey(), userId ?? 'signed-out'], enabled: !!userId, retry: false } });
  const inbox = useListProviderRequests({ query: { queryKey: [...getListProviderRequestsQueryKey(), userId ?? 'signed-out'], enabled: !!userId, refetchInterval: 10000, retry: false } });
  const respond = useRespondProviderRequest();
  const [error, setError] = useState('');
  const alerts = useNewRequestAlerts(inbox.data, inbox.isSuccess, 'provider', userId, language);
  const answer = async (id: string, accept: boolean) => {
    setError('');
    try {
      await respond.mutateAsync({ id, data: { accept } });
      await Promise.all([
        client.invalidateQueries({ queryKey: getListProviderRequestsQueryKey() }),
        client.invalidateQueries({ queryKey: getListRoadsideRequestsQueryKey() }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not respond to the offer');
      void client.invalidateQueries({ queryKey: getListProviderRequestsQueryKey() });
    }
  };
  return <main className="page-wrap">
    <div className="page-header"><h1>{ar ? 'طلبات مقدم الخدمة' : 'Provider inbox'}</h1>
      <p>{ar ? 'لا تُخبر السائق بتوفر الخدمة حتى تقبل الطلب. شارك معرّفك مع مسؤول التوزيع فقط.' : 'Only accept an offer when you can provide help. Share your ID with your dispatch operator.'}</p></div>
    {identity.data && <div className="card demo-panel"><strong>{identity.data.name}</strong><p>{ar ? 'معرّفك للتوزيع: ' : 'Your dispatch ID: '}<code>{identity.data.id}</code></p></div>}
    <NewRequestAlertControls language={language} permission={alerts.permission} feedback={alerts.feedback} onRequestPermission={() => void alerts.requestPermission()} />
    {error && <p role="alert" className="field-error">{error}</p>}
    {inbox.isLoading || identity.isLoading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> :
      inbox.isError || identity.isError ? <p role="alert">{ar ? 'يتطلب الوصول حساب مقدم خدمة معتمداً.' : 'Verified provider access required.'}</p> :
      inbox.data?.length ? <div className="demo-stack">{inbox.data.map(item => <article className="card demo-panel" key={item.id}>
        <h2>{item.service} · {item.status}</h2><p dir="auto">{item.location}</p>
        <p>{ar ? 'السائق:' : 'Driver:'} {item.customerName} · <a href={`tel:${encodeURIComponent(item.customerPhone)}`}>{item.customerPhone}</a></p>
        <p>{ar ? 'المركبة:' : 'Vehicle:'} <span dir="auto">{item.vehicleMake} · {item.vehiclePlate}</span></p>
        {item.unsafe && <p role="alert" className="notice"><strong>{ar ? 'تحذير: أبلغ السائق عن مكان غير آمن.' : 'Safety warning: the driver reported being in an unsafe location.'}</strong></p>}
        {item.notes && <p dir="auto"><strong>{ar ? 'ملاحظات السائق:' : 'Driver notes:'}</strong> {item.notes}</p>}
        {item.destination && <p dir="auto"><strong>{ar ? 'وجهة السحب:' : 'Towing destination:'}</strong> {item.destination}</p>}
        {item.garage && <p dir="auto">{ar ? 'المرآب:' : 'Garage:'} {item.garage}</p>}
        {item.replacementTransport && <p>{ar ? 'النقل البديل مطلوب، ويحتاج تأكيداً منفصلاً.' : 'Replacement transport requested; separate confirmation required.'}</p>}
        {item.recoveryReason && <p dir="auto"><strong>{ar ? 'ملاحظة التوزيع:' : 'Dispatch handoff note:'}</strong> {item.recoveryReason}</p>}
        {item.status === 'offered' && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="button button-navy" disabled={respond.isPending} onClick={() => answer(item.id, true)}>{ar ? 'أقبل وأؤكد توفري' : 'Accept — I am available'}</button>
          <button className="button button-ghost" disabled={respond.isPending} onClick={() => answer(item.id, false)}>{ar ? 'أرفض الطلب' : 'Decline'}</button>
        </div>}
      </article>)}</div> : <p>{ar ? 'لا توجد طلبات موجهة إليك.' : 'No offers addressed to you.'}</p>}
  </main>;
}