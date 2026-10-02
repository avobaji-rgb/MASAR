import { useEffect, useState } from 'react';
import type { DriverProfile, DriverProfileInput } from '@workspace/api-client-react';
import { VehicleDetailsFields } from './VehicleDetailsFields';
import './AccountQuestions.css';

type Language = 'en' | 'ar';
const copy = {
  en: {
    title: 'Make MASAR yours', edit: 'Your driver details', intro: 'A few useful details for your account. You can change them later in your profile.',
    step: 'Step', of: 'of', personal: 'Your details', vehicle: 'Your vehicle', safety: 'Safety contact',
    name: 'Your name', phone: 'Phone number', make: 'Make and model', plate: 'Plate number',
    electric: 'Is this an electric vehicle?', contactName: 'Contact name', contactPhone: 'Contact phone',
      optional: 'Optional profile reference only. To register a plate under your paid plan, use Registered vehicles after subscribing.', contactHint: 'For your reference only. MASAR does not contact this person in the demo.',
    next: 'Continue', back: 'Back', finish: 'Save profile', skip: 'Skip for now', error: 'Please enter your name and phone number.',
    saveError: 'Could not save your profile. Please try again.', saving: 'Saving…', saved: 'Your account profile is saved securely.',
    demo: 'Breakdown reports are still demo-only and stay on this device. No technician or safety contact is notified.',
  },
  ar: {
    title: 'اجعل مسار مناسباً لك', edit: 'بيانات السائق', intro: 'بضع بيانات مفيدة لحسابك. يمكنك تعديلها لاحقاً في ملفك الشخصي.',
    step: 'الخطوة', of: 'من', personal: 'بياناتك', vehicle: 'مركبتك', safety: 'جهة اتصال للسلامة',
    name: 'اسمك', phone: 'رقم الهاتف', make: 'الشركة والطراز', plate: 'رقم اللوحة',
    electric: 'هل هذه مركبة كهربائية؟', contactName: 'اسم جهة الاتصال', contactPhone: 'هاتف جهة الاتصال',
      optional: 'بيانات للملف فقط. لتسجيل لوحة ضمن اشتراكك المدفوع، استخدم صفحة المركبات المسجلة بعد الاشتراك.', contactHint: 'للاطلاع عليه فقط. لا يتصل مسار بهذا الشخص في العرض التجريبي.',
    next: 'متابعة', back: 'رجوع', finish: 'حفظ الملف الشخصي', skip: 'تخطي الآن', error: 'يرجى إدخال اسمك ورقم هاتفك.',
    saveError: 'تعذّر حفظ ملفك الشخصي. حاول مرة أخرى.', saving: 'جارٍ الحفظ…', saved: 'حُفظ ملف حسابك بأمان.',
    demo: 'بلاغات الأعطال تجريبية وتبقى على هذا الجهاز. لا يُخطر أي فني أو جهة اتصال للسلامة.',
  },
};

export function AccountQuestions({ language, profile, onSave, onDone, onSignOut, editing = false }: {
  language: Language; profile: DriverProfile; onSave: (data: DriverProfileInput) => Promise<void>;
  onDone?: () => void; onSignOut?: () => void; editing?: boolean;
}) {
  const t = copy[language];
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DriverProfileInput>({ ...profile });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  useEffect(() => { setDraft({ ...profile }); }, [profile]);
  const update = (key: keyof DriverProfileInput, value: string | boolean) => setDraft(previous => ({ ...previous, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (!draft.name.trim() || !draft.phone.trim()) { setError(t.error); setStep(0); return; }
    if (!editing && step < 2) { setStep(step + 1); return; }
    setSaving(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(), phone: draft.phone.trim(),
        vehicleMake: draft.vehicleMake.trim(), vehiclePlate: draft.vehiclePlate.trim(),
        safetyContactName: draft.safetyContactName.trim(), safetyContactPhone: draft.safetyContactPhone.trim(),
        language, completed: true,
      });
      setSuccess(true);
      onDone?.();
    } catch { setError(t.saveError); }
    finally { setSaving(false); }
  };
  const field = (id: keyof DriverProfileInput, label: string, type = 'text') =>
    <label className="account-field" key={id}><span>{label}</span><input type={type} dir={type === 'tel' ? 'ltr' : 'auto'} value={String(draft[id])} onChange={e => update(id, e.target.value)} maxLength={id === 'phone' || id === 'vehiclePlate' || id === 'safetyContactPhone' ? 40 : 120} autoComplete={id === 'name' ? 'name' : id === 'phone' ? 'tel' : 'off'} /></label>;
  return <section className="account-questions" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="account-questions-heading">
      <span className="account-kicker">MASAR / {editing ? t.edit : `${t.step} ${step + 1} ${t.of} 3`}</span>
      <h1>{editing ? t.edit : t.title}</h1><p>{t.intro}</p>
    </div>
    {!editing && <div className="account-progress" aria-label={`${t.step} ${step + 1} ${t.of} 3`}>{[0, 1, 2].map(i => <span key={i} className={i <= step ? 'active' : ''} />)}</div>}
    <form onSubmit={submit}>
      {(editing || step === 0) && <fieldset><legend>{t.personal}</legend>{field('name', t.name)}{field('phone', t.phone, 'tel')}</fieldset>}
      {(editing || step === 1) && <fieldset><legend>{t.vehicle}</legend><p>{t.optional}</p>
        <VehicleDetailsFields language={language} value={draft.vehicleMake}
          onValueChange={value => update('vehicleMake', value)}
          plate={draft.vehiclePlate} onPlateChange={value => update('vehiclePlate', value)}
          idPrefix="profile-vehicle" />
        {draft.vehicleMake.trim() && <label className="account-check"><input type="checkbox" checked={draft.vehicleElectric} onChange={e => update('vehicleElectric', e.target.checked)} />{t.electric}</label>}
      </fieldset>}
      {(editing || step === 2) && <fieldset><legend>{t.safety}</legend><p>{t.contactHint}</p>{field('safetyContactName', t.contactName)}{draft.safetyContactName.trim() && field('safetyContactPhone', t.contactPhone, 'tel')}</fieldset>}
      {error && <p role="alert" className="field-error">{error}</p>}
      {success && <p role="status" className="account-success">{t.saved}</p>}
      <div className="account-actions">
        {!editing && step > 0 && <button type="button" className="button button-ghost" onClick={() => { setError(''); setStep(step - 1); }}>{t.back}</button>}
        <button type="submit" className="button button-navy" disabled={saving}>{saving ? t.saving : editing || step === 2 ? t.finish : t.next}</button>
        {editing && onSignOut && <button type="button" className="button button-ghost" onClick={onSignOut} data-testid="button-account-signout">{language === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</button>}
        {!editing && step > 0 && step < 2 && <button type="button" className="button button-ghost" onClick={() => setStep(step + 1)}>{t.skip}</button>}
      </div>
    </form>
    <p className="account-demo-notice">{t.demo}</p>
  </section>;
}