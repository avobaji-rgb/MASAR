import { useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { CarFront, FileText, PhoneCall, Plus, ShieldCheck, Star, UserRound } from 'lucide-react';
import { en, type LocaleKey } from '@/locales/en';
import { ar } from '@/locales/ar';
import { activeVehicle, readFleet, saveFleet, type Fleet, type Vehicle } from './demo-data';
import { VehicleDetailsFields } from './VehicleDetailsFields';
import { MembershipPlans } from './MembershipPlans';

type Language = 'en' | 'ar';
type Common = { language: Language; onToast: (message: string) => void };
type Driver = { name: string; phone: string; contactName: string; contactPhone: string };
const VERIFIED_KEY = 'masar-demo-verified-phone-v1';
const copy = (language: Language) => (key: LocaleKey) => (language === 'ar' ? ar[key] : en[key]) as string;
const Head = ({ title, intro, language }: { title: string; intro: string; language: Language }) => <div className="page-header"><div className="eyebrow">MASAR / {copy(language)('demoStatus')}</div><h1>{title}</h1><p>{intro}</p></div>;

export function AccountPage({ language, driver, onSave, onToast }: Common & { driver: Driver; onSave: (name: string, phone: string) => void }) {
  const t = copy(language);
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone);
  const [verified, setVerified] = useState(localStorage.getItem(VERIFIED_KEY) === driver.phone && !!driver.phone);
  const [error, setError] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError(t('accountRequired')); return; }
    const changed = phone.trim() !== driver.phone;
    onSave(name.trim(), phone.trim());
    if (changed) { localStorage.removeItem(VERIFIED_KEY); setVerified(false); onToast(t('accountChanged')); }
    else onToast(t('detailsSaved'));
    setError('');
  };
  return <div className="page-wrap">
    <Head title={t('accountTitle')} intro={t('accountIntro')} language={language} />
    <div className="wide-grid">
      <form className="card form-card demo-form" onSubmit={save}>
        <div className="vehicle-mark"><UserRound size={25} /></div>
        <label className="form-label" htmlFor="account-name">{t('name')}</label>
        <input id="account-name" className="text-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" data-testid="input-account-name" />
        <label className="form-label" htmlFor="account-phone">{t('phone')}</label>
        <input id="account-phone" className="text-input" type="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('phonePlaceholder')} autoComplete="tel" data-testid="input-account-phone" />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="button button-navy" type="submit" data-testid="button-save-account">{t('saveDetails')}</button>
      </form>
      <section className="card demo-panel">
        <div className="vehicle-mark"><ShieldCheck size={24} /></div>
        <h2 style={{ marginTop: 14 }}>{t('accountVerification')}</h2>
        <p className="demo-lead">{t('accountVerificationBody')}</p>
        <p className="demo-note" role="status" data-testid="status-account-verification">{verified ? t('accountConfirmed') : t('accountNotConfirmed')}</p>
        <p dir="ltr" data-testid="text-account-phone">{driver.phone}</p>
        <button type="button" className="button button-ghost" disabled={!driver.phone || !driver.name || phone.trim() !== driver.phone || name.trim() !== driver.name} onClick={() => { localStorage.setItem(VERIFIED_KEY, driver.phone); setVerified(true); onToast(t('accountConfirmed')); }} data-testid="button-confirm-demo-phone">{t('accountConfirm')}</button>
      </section>
    </div>
  </div>;
}

export function VehiclesPage({ language, onToast, onFleetChange }: Common & { onFleetChange: (fleet: Fleet) => void }) {
  const t = copy(language);
  const [fleet, setFleet] = useState<Fleet>(readFleet);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [make, setMake] = useState('');
  const [plate, setPlate] = useState('');
  const [ev, setEv] = useState(false);
  const [error, setError] = useState('');
  const commit = (next: Fleet) => { saveFleet(next); setFleet(next); onFleetChange(next); };
  const begin = (vehicle?: Vehicle) => { setEditing(vehicle?.id ?? null); setMake(vehicle?.make ?? ''); setPlate(vehicle?.plate ?? ''); setEv(vehicle?.ev ?? false); setError(''); setOpen(true); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() || !plate.trim()) { setError(t('vehicleRequired')); return; }
    const item = { id: editing ?? `vehicle-${Date.now()}`, make: make.trim(), plate: plate.trim(), ev };
    const vehicles = editing ? fleet.vehicles.map(v => v.id === editing ? item : v) : [...fleet.vehicles, item];
    commit({ vehicles, activeId: fleet.activeId ?? item.id });
    setOpen(false); onToast(t('vehicleSaved'));
  };
  const remove = (vehicle: Vehicle) => {
    if (!window.confirm(t('deleteVehicleConfirm'))) return;
    const vehicles = fleet.vehicles.filter(v => v.id !== vehicle.id);
    commit({ vehicles, activeId: fleet.activeId === vehicle.id ? vehicles[0]?.id ?? null : fleet.activeId });
    onToast(t('vehicleDeleted'));
  };
  return <div className="page-wrap">
    <Head title={t('vehiclesTitle')} intro={t('vehiclesIntro')} language={language} />
    <div className="demo-actions" style={{ margin: '0 0 18px' }}><button type="button" className="button button-navy" onClick={() => begin()} data-testid="button-add-vehicle"><Plus size={17} />{t('addVehicle')}</button></div>
    {fleet.vehicles.length === 0 ? <div className="card center-empty"><CarFront size={30} /><h2>{t('noVehicles')}</h2><p>{t('noVehiclesBody')}</p></div> : <div className="demo-stack">{fleet.vehicles.map(vehicle => <div className="card demo-vehicle" key={vehicle.id} data-testid={`card-vehicle-${vehicle.id}`}>
      <div className="vehicle-mark"><CarFront size={24} /></div>
      <div className="demo-vehicle-copy"><strong dir="auto">{vehicle.make}</strong><small dir="auto">{vehicle.plate}{vehicle.ev ? ` · ${t('serviceEv')}` : ''}</small></div>
      {fleet.activeId === vehicle.id && <span className="demo-tag">{t('activeVehicle')}</span>}
      <div className="demo-actions">
        {fleet.activeId !== vehicle.id && <button type="button" className="button button-ghost" onClick={() => { commit({ ...fleet, activeId: vehicle.id }); onToast(t('vehicleSelected')); }} data-testid={`button-select-vehicle-${vehicle.id}`}>{t('useVehicle')}</button>}
        <button type="button" className="button button-ghost" onClick={() => begin(vehicle)} data-testid={`button-edit-vehicle-${vehicle.id}`}>{t('editVehicle')}</button>
        <button type="button" className="button demo-reset" onClick={() => remove(vehicle)} data-testid={`button-delete-vehicle-${vehicle.id}`}>{t('deleteVehicle')}</button>
      </div>
    </div>)}</div>}
    {open && <form className="card form-card demo-form vehicle-edit-form" style={{ marginTop: 18 }} onSubmit={submit} data-testid="form-vehicle">
      <h2 style={{ margin: 0 }}>{editing ? t('editVehicle') : t('addVehicle')}</h2>
      <VehicleDetailsFields language={language} value={make} onValueChange={setMake}
        plate={plate} onPlateChange={setPlate} idPrefix="vehicle" />
      <label className="toggle-row"><span>{t('evVehicle')}</span><input type="checkbox" className="switch" checked={ev} onChange={e => setEv(e.target.checked)} data-testid="switch-vehicle-ev" /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="demo-actions"><button type="submit" className="button button-navy" data-testid="button-save-vehicle">{t('saveVehicle')}</button><button type="button" className="button button-ghost" onClick={() => setOpen(false)} data-testid="button-cancel-vehicle">{t('cancel')}</button></div>
    </form>}
  </div>;
}

export function MembershipPage({ language }: { language: Language }) {
  return <MembershipPlans language={language} />;
}

export function ReceiptPage({ language, onToast }: Common) {
  const t = copy(language);
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  let item: { id: string; service: string; date: string; status: string; location: string; vehicle?: Vehicle; rating?: number; destination?: string } | undefined;
  try { const activities = JSON.parse(localStorage.getItem('masar-demo-activity') || '[]'); if (Array.isArray(activities)) item = activities.find(v => v.id === id); } catch { /* show missing state */ }
  const services: Record<string, LocaleKey> = { flat: 'serviceFlat', battery: 'serviceBattery', fuel: 'serviceFuel', tow: 'serviceTow', lockout: 'serviceLockout', ev: 'serviceEv', other: 'serviceOther' };
  const statuses: Record<string, LocaleKey> = { dispatch: 'dispatch', assigned: 'assigned', enroute: 'enroute', arrived: 'arrived', completed: 'completed' };
  return <div className="page-wrap"><Head title={t('receiptTitle')} intro={t('receiptIntro')} language={language} />
    {!item ? <div className="card center-empty"><FileText size={30} /><h2>{t('receiptMissing')}</h2><Link href="/activity" className="button button-navy" data-testid="link-receipt-back">{t('receiptBack')}</Link></div> :
    <div className="wide-grid"><section className="card demo-panel" data-testid="detail-demo-request">
      <div className="vehicle-mark"><FileText size={24} /></div><h2 style={{ marginTop: 15 }}>{t(services[item.service] || 'serviceOther')}</h2>
      <div className="demo-note">{t('receiptIntro')}</div>
      <dl>
        <div className="demo-detail"><dt>{t('receiptTime')}</dt><dd>{new Date(item.date).toLocaleString(language === 'ar' ? 'ar-SY' : 'en-SY')}</dd></div>
        <div className="demo-detail"><dt>{t('demoStatus')}</dt><dd>{t(statuses[item.status] || 'dispatch')}</dd></div>
        <div className="demo-detail"><dt>{t('receiptVehicle')}</dt><dd dir="auto">{item.vehicle ? `${item.vehicle.make} · ${item.vehicle.plate}` : t('receiptUnspecified')}</dd></div>
        <div className="demo-detail"><dt>{t('location')}</dt><dd dir="auto">{item.location}</dd></div>
        <div className="demo-detail"><dt>{t('membershipLabel')}</dt><dd>{t('membershipDemoNote')}</dd></div>
        <div className="demo-detail"><dt>{t('receiptRating')}</dt><dd>{item.rating ? `${item.rating}/5` : t('receiptNone')}</dd></div>
      </dl>
      <div className="demo-actions"><Link href="/activity" className="button button-ghost" data-testid="link-receipt-activity">{t('receiptBack')}</Link><button type="button" className="button button-navy" onClick={() => { localStorage.setItem('masar-current-request', item!.id); onToast(t('demoOnly')); setLocation('/tracking'); }} data-testid="button-receipt-tracking">{t('receiptTrack')}</button></div>
    </section><section className="card demo-panel"><Star size={23} color="hsl(var(--primary))" /><h2 style={{ marginTop: 12 }}>{t('receiptRating')}</h2><p className="demo-lead">{item.rating ? `${item.rating}/5 · ${t('ratingSaved')}` : t('rateHint')}</p><p className="demo-note">{t('demoOnly')}</p></section></div>}
  </div>;
}

export function EmergencyCallCard({ language }: { language: Language }) {
  const t = copy(language);
  return <section className="card sos-call-card" aria-label={t('sosTitle')} data-testid="card-sos-call">
    <div className="sos-call-copy"><span className="sos-call-icon"><PhoneCall size={24} aria-hidden="true" /></span><div><h2>{t('sosTitle')}</h2><p>{t('sosText')}</p></div></div>
    <a href="tel:112" className="button sos-call-button" data-testid="link-call-sos"><PhoneCall size={19} aria-hidden="true" />{t('sosButton')}</a>
  </section>;
}

export function SafetyPage({ language, driver, onSaveContact, onToast }: Common & { driver: Driver; onSaveContact: (name: string, phone: string) => void }) {
  const t = copy(language);
  const [name, setName] = useState(driver.contactName);
  const [phone, setPhone] = useState(driver.contactPhone);
  const [error, setError] = useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!name.trim() || !phone.trim()) { setError(t('accountRequired')); return; } onSaveContact(name.trim(), phone.trim()); setError(''); onToast(t('contactSaved')); };
  return <div className="page-wrap">
    <Head title={t('safetyTitle')} intro={t('safetyIntro')} language={language} />
    <EmergencyCallCard language={language} />
    <div className="wide-grid"><section className="card demo-panel"><h2>{t('safetyFlag')}</h2><ol className="demo-steps"><li>{t('safetyStep1')}</li><li>{t('safetyStep2')}</li><li>{t('safetyStep3')}</li><li>{t('safetyStep4')}</li></ol></section>
    <form className="card form-card" onSubmit={submit}><h2 style={{ margin: 0 }}>{t('safetyContact')}</h2><p className="demo-lead" style={{ marginTop: 10 }}>{driver.contactName ? `${driver.contactName} · ${driver.contactPhone}` : t('safetyContactEmpty')}</p><p className="demo-note">{t('safetyNoCall')}</p>
      <label className="form-label" htmlFor="safety-name">{t('contactName')}</label><input id="safety-name" className="text-input" value={name} onChange={e => setName(e.target.value)} data-testid="input-safety-name" />
      <label className="form-label" htmlFor="safety-phone">{t('contactPhone')}</label><input id="safety-phone" className="text-input" type="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} data-testid="input-safety-phone" />
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="button button-navy" style={{ marginTop: 15 }} data-testid="button-save-safety-contact">{t('saveContact')}</button>
    </form></div>
  </div>;
}

export function DemoToolLinks({ language }: { language: Language }) {
  const t = copy(language);
  return <div className="demo-links">
    <Link href="/account" className="demo-link" data-testid="link-demo-account"><UserRound size={20} />{t('navAccount')}</Link>
    <Link href="/vehicles" className="demo-link" data-testid="link-demo-vehicles"><CarFront size={20} />{t('navVehicles')}</Link>
    <Link href="/membership" className="demo-link" data-testid="link-demo-membership"><FileText size={20} />{t('navMembership')}</Link>
    <Link href="/safety" className="demo-link" data-testid="link-demo-safety"><ShieldCheck size={20} />{t('navSafety')}</Link>
  </div>;
}

export { activeVehicle };