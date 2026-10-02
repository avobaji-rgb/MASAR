import { Link } from 'wouter';
import { useListRoadsideRequests, getListRoadsideRequestsQueryKey } from '@workspace/api-client-react';

export function LiveRequests({ language }: { language: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const requests = useListRoadsideRequests({ query: { queryKey: getListRoadsideRequestsQueryKey(), staleTime: 0, refetchInterval: 10000 } });
  return <main className="page-wrap">
    <div className="page-header"><h1>{ar ? 'طلبات المساعدة' : 'Assistance requests'}</h1>
      <p>{ar ? 'تُعرض الطلبات لفريق التوزيع. لا تتأكد الخدمة إلا بعد قبول مقدم الخدمة للطلب بنفسه. يتم تحديث الحالة تلقائياً.' : 'Requests enter the dispatch queue. Help is not confirmed until a provider accepts the offer themselves. Status refreshes automatically.'}</p></div>
    {requests.isLoading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> : requests.isError ?
      <p role="alert">{ar ? 'تعذّر تحميل الطلبات.' : 'Could not load requests.'}</p> :
      requests.data?.length ? <div className="demo-stack">{requests.data.map(request =>
        <article className="card demo-panel" key={request.id}>
          <h2>{request.service}</h2><p dir="auto">{request.location}</p>
          <p>{ar ? 'المركبة:' : 'Vehicle:'} <span dir="auto">{request.vehicleMake} · {request.vehiclePlate}</span></p>
          <p>{ar ? 'جهة الاتصال:' : 'Contact:'} {request.customerName} · <a href={`tel:${encodeURIComponent(request.customerPhone)}`}>{request.customerPhone}</a></p>
          {request.unsafe && <p role="alert" className="notice"><strong>{ar ? 'تحذير: أبلغت عن وجودك في مكان غير آمن.' : 'Safety warning: you reported being in an unsafe location.'}</strong></p>}
          {request.notes && <p dir="auto"><strong>{ar ? 'ملاحظاتك:' : 'Your notes:'}</strong> {request.notes}</p>}
          {request.destination && <p dir="auto"><strong>{ar ? 'وجهة السحب:' : 'Towing destination:'}</strong> {request.destination}</p>}
          {request.garage && <p>{ar ? 'المرآب المختار:' : 'Chosen garage:'} <span dir="auto">{request.garage}</span></p>}
          {request.replacementTransport && <p>{ar ? 'النقل البديل: ' : 'Replacement transport: '}{ar ? ({ pending: 'بانتظار التأكيد', confirmed: 'تم تأكيد توفره', unavailable: 'غير متاح', not_requested: 'لم يُطلب' }[request.transportStatus] ?? request.transportStatus) : ({ pending: 'awaiting confirmation', confirmed: 'availability confirmed', unavailable: 'unavailable', not_requested: 'not requested' }[request.transportStatus] ?? request.transportStatus)}</p>}
          <p className="demo-note" role="status">{ar ? ({ pending: 'بانتظار مقدم خدمة', offered: 'أُرسل الطلب لمقدم خدمة، بانتظار رده', accepted: 'أكد مقدم الخدمة توفره', enroute: 'مقدم الخدمة في الطريق', arrived: 'وصل مقدم الخدمة', completed: 'اكتملت الخدمة', unavailable: 'الخدمة غير متاحة' }[request.status] ?? request.status) : ({ pending: 'Awaiting provider', offered: 'Sent to a provider; awaiting their reply', accepted: 'Provider acknowledged availability', enroute: 'Provider en route', arrived: 'Provider arrived', completed: 'Service completed', unavailable: 'Service unavailable' }[request.status] ?? request.status)}</p>
          {request.operatorName && <p>{ar ? 'المسؤول: ' : 'Operator: '}{request.operatorName}</p>}
          {request.providerName && <p>{ar ? 'مقدم الخدمة: ' : 'Provider: '}{request.providerName}</p>}
          {request.statusNote && <p dir="auto">{request.statusNote}</p>}
          <small>{new Date(request.updatedAt).toLocaleString(ar ? 'ar' : 'en')}</small>
        </article>)}</div> : <div className="card center-empty"><p>{ar ? 'لا توجد طلبات مسجلة بعد.' : 'No recorded requests yet.'}</p>
        <Link href="/request" className="button button-navy">{ar ? 'طلب المساعدة' : 'Request help'}</Link></div>}
  </main>;
}