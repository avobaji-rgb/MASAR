import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListPartnerReviews, useReviewPartnerCompany, useListPartnerAudit, getPartnerAsset,
  useListEligiblePartnerCompanies, useOfferPartnerJob,
  getListPartnerReviewsQueryKey, getListPartnerAuditQueryKey, getListDispatchRequestsQueryKey,
  type PartnerCompany, type RoadsideRequest,
} from '@workspace/api-client-react';

const msg = (e: unknown, fb: string) => e instanceof Error && e.message ? e.message : fb;

export function PartnerCompanyAdmin({ language }: { language: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const client = useQueryClient();
  const reviews = useListPartnerReviews({ query: { queryKey: getListPartnerReviewsQueryKey(), retry: false } });
  const audit = useListPartnerAudit({ query: { queryKey: getListPartnerAuditQueryKey(), retry: false, enabled: false } });
  const review = useReviewPartnerCompany();
  const [open, setOpen] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [assetBusy, setAssetBusy] = useState('');
  const decide = async (c: PartnerCompany, status: 'approved' | 'rejected' | 'blocked') => {
    const r = (reason[c.id] ?? '').trim();
    setError('');
    if (!r) { setError(ar ? 'أدخل سبب القرار.' : 'Enter a reason for this decision.'); return; }
    try {
      await review.mutateAsync({ companyId: c.id, data: { status, reason: r, expectedVersion: c.version } });
      await Promise.all([
        client.invalidateQueries({ queryKey: getListPartnerReviewsQueryKey() }),
        client.invalidateQueries({ queryKey: getListPartnerAuditQueryKey() }),
      ]);
    } catch (e) {
      setError(msg(e, ar ? 'تعذر حفظ القرار؛ ربما تغيّر السجل.' : 'Decision failed; the record may have changed.'));
      void client.invalidateQueries({ queryKey: getListPartnerReviewsQueryKey() });
    }
  };
  const openDoc = async (c: PartnerCompany, id: string) => {
    setAssetBusy(id); setError('');
    try { const a = await getPartnerAsset(c.id, id); window.open(a.url, '_blank', 'noopener,noreferrer'); }
    catch (e) { setError(msg(e, ar ? 'تعذر فتح المستند.' : 'Could not open document.')); }
    finally { setAssetBusy(''); }
  };
  const statusLabel = (s: string) => ({ pending: ar ? 'قيد المراجعة' : 'Pending', approved: ar ? 'معتمدة' : 'Approved', rejected: ar ? 'مرفوضة' : 'Rejected', blocked: ar ? 'محظورة' : 'Blocked' }[s] ?? s);
  const list = reviews.data ?? [];
  const toggleAudit = () => { const next = !showAudit; setShowAudit(next); if (next) void audit.refetch(); };
  return <section className="card demo-panel" style={{ marginBottom: 16 }} data-testid="section-company-admin">
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <h2 style={{ margin: 0 }}>{ar ? 'مراجعة الشركات الشريكة' : 'Partner company review'}{list.length ? ` (${list.length})` : ''}</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="button button-ghost" onClick={toggleAudit} data-testid="button-toggle-partner-audit">{ar ? 'سجل التدقيق' : 'Audit log'}</button>
        <button type="button" className="button button-navy" onClick={() => setOpen(v => !v)} aria-expanded={open} data-testid="button-toggle-company-review">{open ? (ar ? 'إخفاء' : 'Hide') : (ar ? 'عرض' : 'Show')}</button>
      </div>
    </div>
    {error && <p role="alert" className="field-error">{error}</p>}
    {open && (reviews.isLoading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
      : reviews.isError ? <p role="alert">{ar ? 'تعذر تحميل الطلبات.' : 'Could not load reviews.'} <button className="button button-ghost" onClick={() => void reviews.refetch()}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></p>
      : !list.length ? <p>{ar ? 'لا توجد شركات بانتظار المراجعة.' : 'No companies awaiting review.'}</p>
      : <div className="demo-stack" style={{ marginTop: 12 }}>{list.map(c => <article key={c.id} className="card demo-panel" data-testid={`card-company-review-${c.id}`}>
        <h3 dir="auto" style={{ margin: '0 0 8px' }}>{c.name} · <span className="demo-tag">{statusLabel(c.status)}</span></h3>
        <p dir="auto">{c.type} · {c.city}, {c.area} · {c.address}</p>
        <p>{ar ? 'المسؤول:' : 'Contact:'} <span dir="auto">{c.contact}</span> · <a href={`tel:${encodeURIComponent(c.phone)}`}>{c.phone}</a></p>
        <p dir="auto">{ar ? 'الدوام:' : 'Hours:'} {c.hours}</p>
        {!!c.services.length && <p dir="auto">{ar ? 'الخدمات:' : 'Services:'} {c.services.join(' · ')}</p>}
        {c.reviewReason && <p dir="auto"><strong>{ar ? 'سبب سابق:' : 'Previous reason:'}</strong> {c.reviewReason}</p>}
        <div><strong>{ar ? 'المستندات الخاصة' : 'Private documents'}</strong>
          {c.documents.length ? <div className="demo-actions">{c.documents.map((d, i) => <button key={d} type="button" className="button button-ghost" disabled={assetBusy === d} onClick={() => void openDoc(c, d)} data-testid={`button-open-doc-${c.id}-${i}`}>{ar ? `مستند ${i + 1}` : `Document ${i + 1}`}</button>)}</div>
            : <p>{ar ? 'لم يرفع أي مستند.' : 'No documents uploaded.'}</p>}</div>
        <label className="form-label" htmlFor={`review-reason-${c.id}`}>{ar ? 'سبب القرار' : 'Decision reason'}</label>
        <input id={`review-reason-${c.id}`} className="text-input" maxLength={500} value={reason[c.id] ?? ''} onChange={e => setReason(v => ({ ...v, [c.id]: e.target.value }))} />
        <div className="demo-actions">
          <button className="button button-navy" disabled={review.isPending} onClick={() => void decide(c, 'approved')} data-testid={`button-approve-${c.id}`}>{ar ? 'اعتماد' : 'Approve'}</button>
          <button className="button button-ghost" disabled={review.isPending} onClick={() => void decide(c, 'rejected')} data-testid={`button-reject-${c.id}`}>{ar ? 'رفض' : 'Reject'}</button>
          <button className="button button-danger" disabled={review.isPending} onClick={() => void decide(c, 'blocked')} data-testid={`button-block-${c.id}`}>{ar ? 'حظر' : 'Block'}</button>
        </div>
      </article>)}</div>)}
    {showAudit && (audit.isFetching ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
      : audit.isError ? <p role="alert">{ar ? 'تعذر تحميل السجل.' : 'Could not load audit log.'}</p>
      : !audit.data?.length ? <p>{ar ? 'لا توجد سجلات.' : 'No audit entries.'}</p>
      : <ul style={{ paddingInlineStart: 18, fontSize: 13, lineHeight: 1.6 }} data-testid="list-partner-audit">{audit.data.map(a => <li key={a.id} dir="auto"><strong>{a.action}</strong> · {new Date(a.createdAt).toLocaleString(language)} · {a.details}</li>)}</ul>)}
  </section>;
}

export function CompanyOffer({ item, language }: { item: RoadsideRequest; language: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const eligible = useListEligiblePartnerCompanies(item.id, { query: { queryKey: ['eligible-partner-companies', item.id, item.updatedAt], enabled: open, retry: false } });
  const offer = useOfferPartnerJob();
  const send = async () => {
    setError('');
    try {
      await offer.mutateAsync({ requestId: item.id, data: { companyId, expectedUpdatedAt: item.updatedAt, expiresInSeconds: 300 } });
      setOpen(false); setCompanyId('');
      await client.invalidateQueries({ queryKey: getListDispatchRequestsQueryKey() });
    } catch (e) {
      setError(msg(e, ar ? 'تعذر إرسال العرض؛ ربما تغيّر الطلب.' : 'Offer failed; the request may have changed.'));
      void client.invalidateQueries({ queryKey: getListDispatchRequestsQueryKey() });
    }
  };
  return <div style={{ marginTop: 12 }}>
    <button type="button" className="button button-ghost" onClick={() => setOpen(v => !v)} aria-expanded={open} data-testid={`button-company-offer-${item.id}`}>{ar ? 'عرض على شركة شريكة' : 'Offer to partner company'}</button>
    {open && <div style={{ marginTop: 8 }}>
      {eligible.isLoading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
        : eligible.isError ? <p role="alert">{ar ? 'تعذر تحميل الشركات المؤهلة.' : 'Could not load eligible companies.'}</p>
        : !eligible.data?.length ? <p>{ar ? 'لا توجد شركات مؤهلة ومتاحة لهذا الطلب.' : 'No eligible, available companies for this request.'}</p>
        : <>
          <label className="form-label" htmlFor={`company-${item.id}`}>{ar ? 'الشركة المؤهلة' : 'Eligible company'}</label>
          <select id={`company-${item.id}`} className="select-input" value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">{ar ? 'اختر شركة' : 'Select company'}</option>
            {eligible.data.map(c => <option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}
          </select>
          <p className="demo-lead" style={{ marginTop: 6 }}>{ar ? 'ينتهي العرض بعد 5 دقائق. لا يُؤكد التوفر قبل قبول الشركة.' : 'The offer expires in 5 minutes. Availability is confirmed only when the company accepts.'}</p>
          <button type="button" className="button button-navy" disabled={!companyId || offer.isPending} onClick={() => void send()} data-testid={`button-send-company-offer-${item.id}`}>{ar ? 'إرسال العرض' : 'Send offer'}</button>
        </>}
      {error && <p role="alert" className="field-error">{error}</p>}
    </div>}
  </div>;
}
