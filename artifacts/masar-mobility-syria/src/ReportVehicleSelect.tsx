import { en, type LocaleKey } from '@/locales/en';
import { ar } from '@/locales/ar';
import { type Fleet, type Vehicle, type VehicleChoice } from './demo-data';

export function ReportVehicleSelect({ id, language, fleet, account, value, onChange }: {
  id: string; language: 'en' | 'ar'; fleet: Fleet; account: Vehicle | null;
  value: VehicleChoice; onChange: (choice: VehicleChoice) => void;
}) {
  const t = (key: LocaleKey) => (language === 'ar' ? ar[key] : en[key]) as string;
  return <>
    <label className="form-label" htmlFor={id}>{t('reportVehicleLabel')}</label>
    <select id={id} className="select-input" value={value} onChange={e => onChange(e.target.value as VehicleChoice)} data-testid={id}>
      <option value="none">{t('reportVehicleNone')}</option>
      {account && <option value="account">{t('reportVehicleAccount')}: {account.make} · {account.plate}</option>}
      {fleet.vehicles.map(vehicle => <option key={vehicle.id} value={`demo:${vehicle.id}`}>{t('reportVehicleDemo')}: {vehicle.make} · {vehicle.plate}</option>)}
    </select>
  </>;
}