import { useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetMembership, useListRegisteredVehicles, useRegisterVehicle, useUpdateRegisteredVehicle,
  useDeleteRegisteredVehicle, getListRegisteredVehiclesQueryKey, getGetMembershipQueryKey,
} from '@workspace/api-client-react';
import { VehicleDetailsFields } from './VehicleDetailsFields';

export function LiveVehicles({ language }: { language: 'en' | 'ar' }) {
  const ar = language === 'ar';
  const client = useQueryClient();
  const membership = useGetMembership({ query: { queryKey: getGetMembershipQueryKey(), staleTime: 0 } });
  const vehicles = useListRegisteredVehicles();
  const create = useRegisterVehicle();
  const update = useUpdateRegisteredVehicle();
  const remove = useDeleteRegisteredVehicle();
  const [editing, setEditing] = useState<string | null>(null);
  const [make, setMake] = useState('');
  const [plate, setPlate] = useState('');
  const [electric, setElectric] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: getListRegisteredVehiclesQueryKey() });
  const begin = (v?: { id: string; make: string; plate: string; electric: boolean }) => {
    setEditing(v?.id ?? null); setMake(v?.make ?? ''); setPlate(v?.plate ?? '');
    setElectric(v?.electric ?? false); setError(''); setOpen(true);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!make.trim() || !plate.trim()) { setError(ar ? 'أدخل نوع المركبة ورقم اللوحة.' : 'Enter a make and plate.'); return; }
    try {
      const data = { make: make.trim(), plate: plate.trim(), electric };
      if (editing) await update.mutateAsync({ id: editing, data });
      else await create.mutateAsync({ data });
      await refresh(); setOpen(false); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save vehicle'); }
  };
  return <main className="page-wrap">
    <div className="page-header"><h1>{ar ? 'المركبات المسجلة' : 'Registered vehicles'}</h1>
      <p>{ar ? 'المركبات المسجلة في اشتراكك المدفوع، وليس المركبات المحفوظة في العرض التجريبي.' : 'Vehicles on your paid membership, separate from demo vehicles saved on this device.'}</p></div>
    {membership.isLoading || vehicles.isLoading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> :
      membership.isError || vehicles.isError ? <p role="alert">{ar ? 'تعذّر التحقق من الاشتراك. حاول مجدداً.' : 'Could not verify membership. Try again.'}</p> : <>
      <p className="demo-note">{membership.data?.active
        ? `${membership.data.plan === 'premium' ? 'Premium' : 'Basic'} · ${vehicles.data?.length ?? 0}/${membership.data.vehicleLimit}`
        : ar ? 'لا يوجد اشتراك مدفوع نشط. اشترك لتسجيل مركبة.' : 'No active paid subscription. Subscribe to register a vehicle.'}</p>
      {membership.data?.active && (vehicles.data?.length ?? 0) > membership.data.vehicleLimit && <p role="alert" className="field-error">{ar ? 'تجاوزت حد مركبات باقتك. احذف المركبات الزائدة قبل طلب المساعدة.' : 'Your vehicle count exceeds the current plan. Remove extras before submitting requests.'}</p>}
      {!membership.data?.active && <Link href="/membership" className="button button-navy">{ar ? 'عرض الاشتراكات' : 'View plans'}</Link>}
      {membership.data?.active && (vehicles.data?.length ?? 0) < membership.data.vehicleLimit &&
        <button className="button button-navy" type="button" onClick={() => begin()}>{ar ? 'إضافة مركبة' : 'Add vehicle'}</button>}
      <div className="demo-stack" style={{ marginTop: 16 }}>{vehicles.data?.map(v =>
        <div className="card demo-vehicle" key={v.id}><div className="demo-vehicle-copy"><strong dir="auto">{v.make}</strong><small dir="auto">{v.plate}</small></div>
          <div className="demo-actions"><button className="button button-ghost" onClick={() => begin(v)} disabled={!membership.data?.active}>{ar ? 'تعديل' : 'Edit'}</button>
          <button className="button demo-reset" onClick={async () => { if (!window.confirm(ar ? 'حذف المركبة؟' : 'Remove this vehicle?')) return; try { await remove.mutateAsync({ id: v.id }); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove vehicle'); } }}>{ar ? 'حذف' : 'Remove'}</button></div></div>)}</div>
      {open && <form className="card form-card demo-form" onSubmit={submit} style={{ marginTop: 16 }}>
        <VehicleDetailsFields language={language} value={make} onValueChange={setMake} plate={plate} onPlateChange={setPlate} idPrefix="registered-vehicle" />
        <label className="toggle-row">{ar ? 'مركبة كهربائية' : 'Electric vehicle'} <input type="checkbox" checked={electric} onChange={e => setElectric(e.target.checked)} /></label>
        <button className="button button-navy" type="submit" disabled={create.isPending || update.isPending}>{ar ? 'حفظ' : 'Save vehicle'}</button>
        <button className="button button-ghost" type="button" onClick={() => setOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button>
      </form>}
      {error && <p role="alert" className="field-error">{error}</p>}
    </>}
  </main>;
}