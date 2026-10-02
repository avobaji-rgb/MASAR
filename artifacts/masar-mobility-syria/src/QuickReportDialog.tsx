import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CircleAlert, MapPin, Navigation, Plus, X } from 'lucide-react';
import { en, type LocaleKey } from '@/locales/en';
import { ar } from '@/locales/ar';
import { readFleet, resolveReportVehicle, type Vehicle, type VehicleChoice } from './demo-data';
import { saveNewDemoRequest, type Activity, type ServiceKey } from './demo-requests';
import { ReportVehicleSelect } from './ReportVehicleSelect';

type Language = 'en' | 'ar';
const services: { value: ServiceKey; label: LocaleKey }[] = [
  { value: 'flat', label: 'serviceFlat' },
  { value: 'battery', label: 'serviceBattery' },
  { value: 'fuel', label: 'serviceFuel' },
  { value: 'tow', label: 'serviceTow' },
  { value: 'lockout', label: 'serviceLockout' },
  { value: 'ev', label: 'serviceEv' },
  { value: 'other', label: 'serviceOther' },
];

export function QuickReportDialog({
  open, language, initialNotes = '', accountVehicle, onDismiss, onSubmitted,
}: {
  open: boolean; language: Language; initialNotes?: string; accountVehicle: Vehicle | null; onDismiss: () => void; onSubmitted: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const [service, setService] = useState<ServiceKey | ''>('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [unsafe, setUnsafe] = useState(false);
  const [findingLocation, setFindingLocation] = useState(false);
  const [error, setError] = useState('');
  const [vehicleChoice, setVehicleChoice] = useState<VehicleChoice>('none');
  const fleet = open ? readFleet() : { vehicles: [], activeId: null };
  const copy = language === 'ar' ? ar : en;
  const t = (key: LocaleKey) => copy[key] as string;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const activeId = readFleet().activeId;
      setVehicleChoice(activeId ? `demo:${activeId}` : 'none');
      if (initialNotes.trim()) setNotes(initialNotes.trim().slice(0, 500));
      dialog.showModal();
      serviceRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setError(t('locationUnavailable')); return; }
    setFindingLocation(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        setFindingLocation(false);
      },
      () => { setFindingLocation(false); setError(t('locationUnavailable')); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!service || !location.trim()) { setError(t('quickReportRequired')); return; }
    const selectedVehicle = resolveReportVehicle(vehicleChoice, readFleet(), accountVehicle);
    if (vehicleChoice !== 'none' && !selectedVehicle) { setError(t('reportVehicleUnavailable')); return; }
    const item: Activity = {
      id: `demo-${crypto.randomUUID()}`,
      service, date: new Date().toISOString(), status: 'dispatch',
      notes: notes.trim(), unsafe, location: location.trim(), destination: '',
      code: String(Math.floor(1000 + Math.random() * 9000)),
      vehicle: selectedVehicle,
    };
    try {
      saveNewDemoRequest(item);
    } catch {
      setError(t('quickReportSaveError'));
      return;
    }
    setService('');
    setLocation('');
    setNotes('');
    setUnsafe(false);
    setVehicleChoice('none');
    setError('');
    onSubmitted();
  };

  return <dialog
    ref={dialogRef}
    className="quick-report-dialog"
    dir={language === 'ar' ? 'rtl' : 'ltr'}
    aria-labelledby="quick-report-heading"
    aria-describedby="quick-report-intro"
    onCancel={onDismiss}
    onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}
  >
    <div className="quick-report-content">
      <header className="quick-report-header">
        <span className="quick-report-emblem"><Plus size={22} aria-hidden="true" /></span>
        <div><span className="quick-report-kicker">MASAR · {t('demoStatus')}</span><h2 id="quick-report-heading">{t('quickReportTitle')}</h2></div>
        <button type="button" className="quick-report-close" aria-label={t('close')} onClick={onDismiss}><X size={19} /></button>
      </header>
      <p id="quick-report-intro" className="quick-report-intro">{t('quickReportIntro')}</p>
      <form onSubmit={submit}>
        <label className="form-label" htmlFor="quick-service">{t('whatHappened')}</label>
        <select ref={serviceRef} id="quick-service" className="select-input" value={service} onChange={(event) => { setService(event.target.value as ServiceKey | ''); setError(''); }} required data-testid="select-quick-service">
          <option value="">{t('selectService')}</option>
          {services.map(({ value, label }) => <option key={value} value={value}>{t(label)}</option>)}
        </select>
        <ReportVehicleSelect id="quick-report-vehicle" language={language} fleet={fleet} account={accountVehicle} value={vehicleChoice} onChange={setVehicleChoice} />
        <label className="form-label" htmlFor="quick-location">{t('whereAreYou')}</label>
        <div className="quick-report-location">
          <MapPin size={18} aria-hidden="true" />
          <input id="quick-location" className="text-input" value={location} onChange={(event) => { setLocation(event.target.value); setError(''); }} placeholder={t('locationPlaceholder')} autoComplete="street-address" required data-testid="input-quick-location" />
        </div>
        <button type="button" className="quick-report-geolocate" onClick={useCurrentLocation} disabled={findingLocation} data-testid="button-quick-geolocation"><Navigation size={15} /> {findingLocation ? t('findingLocation') : t('useCurrentLocation')}</button>
        <label className="form-label" htmlFor="quick-notes">{t('optionalNotes')}</label>
        <textarea id="quick-notes" className="textarea" rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('notesPlaceholder')} data-testid="input-quick-notes" />
        <label className="quick-report-safety"><input type="checkbox" checked={unsafe} onChange={(event) => setUnsafe(event.target.checked)} /> <span>{t('unsafe')}</span></label>
        {unsafe && <p className="quick-report-warning">{t('highwayAdvice')}</p>}
        <p className="quick-report-disclaimer"><CircleAlert size={18} aria-hidden="true" /><span>{t('quickReportDisclaimer')}</span></p>
        {error && <p role="alert" className="field-error">{error}</p>}
        <button type="submit" className="button button-navy button-block" data-testid="button-save-quick-report">{t('quickReportSubmit')}</button>
      </form>
    </div>
  </dialog>;
}