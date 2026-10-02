import { useState, type FormEvent } from 'react';
import { useConfirmBankMembership } from '@workspace/api-client-react';

export function BankPaymentsAdmin({ language }: { language: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const [userId, setUserId] = useState('');
  const [plan, setPlan] = useState<'basic' | 'premium'>('basic');
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual');
  const [confirmedPayment, setConfirmedPayment] = useState(false);
  const [message, setMessage] = useState('');
  const confirm = useConfirmBankMembership();
  const expectedUsd = plan === 'basic' ? (billing === 'annual' ? 99 : 13) : (billing === 'annual' ? 179 : 18);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      await confirm.mutateAsync({ data: { userId: userId.trim(), plan, billing, confirmedPayment: true } });
      setMessage(ar ? 'تم تفعيل العضوية بعد تأكيد استلام المبلغ.' : 'Membership activated after bank payment confirmation.');
      setUserId('');
      setConfirmedPayment(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ar ? 'تعذر تأكيد الدفع.' : 'Could not confirm payment.'));
    }
  };

  return <main className="page-wrap" dir={ar ? 'rtl' : 'ltr'} lang={language}>
    <div className="page-header">
      <h1>{ar ? 'تأكيد التحويل المصرفي' : 'Confirm bank transfer'}</h1>
      <p>{ar ? 'للمشغلين المعتمدين فقط. تحقق من وصول المبلغ في كشف حساب البنك قبل تفعيل عضوية العميل.' : 'For verified operators only. Check the business bank statement before activating a customer membership.'}</p>
    </div>
    <form className="card form-card" onSubmit={submit}>
      <label className="form-label" htmlFor="bank-customer">{ar ? 'معرّف حساب العميل' : 'Customer account ID'}</label>
      <input className="text-input" id="bank-customer" required maxLength={200} value={userId} onChange={e => setUserId(e.target.value)} autoComplete="off" />
      <label className="form-label" htmlFor="bank-plan">{ar ? 'الباقة' : 'Plan'}</label>
      <select className="text-input" id="bank-plan" value={plan} onChange={e => setPlan(e.target.value as 'basic' | 'premium')}>
        <option value="basic">{ar ? 'الأساسية' : 'Basic'}</option>
        <option value="premium">{ar ? 'المميزة' : 'Premium'}</option>
      </select>
      <label className="form-label" htmlFor="bank-billing">{ar ? 'المدة' : 'Billing period'}</label>
      <select className="text-input" id="bank-billing" value={billing} onChange={e => setBilling(e.target.value as 'annual' | 'monthly')}>
        <option value="annual">{ar ? 'سنة واحدة' : 'One year'}</option>
        <option value="monthly">{ar ? 'شهر واحد' : 'One month'}</option>
      </select>
      <p>{ar ? 'المبلغ المتوقع حسب الباقة المقترحة:' : 'Expected amount for the proposed plan:'} ${expectedUsd} USD</p>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
        <input type="checkbox" required checked={confirmedPayment} onChange={e => setConfirmedPayment(e.target.checked)} />
        {ar ? 'تحققت بنفسي من وصول المبلغ الصحيح إلى حسابنا المصرفي' : 'I checked that the correct amount arrived in our business bank account'}
      </label>
      <button type="submit" className="button button-navy" style={{ marginTop: 16 }} disabled={!userId.trim() || !confirmedPayment || confirm.isPending}>
        {confirm.isPending ? (ar ? 'جارٍ التأكيد…' : 'Confirming…') : (ar ? 'تفعيل العضوية' : 'Activate membership')}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  </main>;
}