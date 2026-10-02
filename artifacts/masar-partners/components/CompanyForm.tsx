import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { PartnerCompany, PartnerCompanyInput } from '@workspace/api-client-react';
import { useUI } from '@/lib/i18n';
import { useDraft } from '@/lib/drafts';
import { SERVICE_PRESETS, presetLabelKey } from '@/lib/format';
import { Banner, Button, Chip, Field, SectionTitle, T, wrapRow } from './ui';

export type CompanyValues = Omit<PartnerCompanyInput, 'expectedVersion'>;
const EMPTY: CompanyValues = { name: '', type: 'towing', phone: '', contact: '', address: '', city: '', area: '', hours: '', services: [] };

function fromCompany(c?: PartnerCompany): CompanyValues {
  if (!c) return EMPTY;
  return { name: c.name, type: c.type, phone: c.phone, contact: c.contact, address: c.address, city: c.city, area: c.area, hours: c.hours, services: c.services };
}

export function CompanyForm({ scope, company, submitLabel, onSubmit, busy, errorText, section }: {
  scope: string; company?: PartnerCompany; submitLabel: string; busy: boolean; errorText?: string | null;
  onSubmit: (v: CompanyValues) => Promise<boolean>; section?: 'all' | 'services' | 'hours';
}) {
  const ui = useUI();
  const initial = useMemo(() => fromCompany(company), [company]);
  const [v, setV] = useState<CompanyValues>(initial);
  const [custom, setCustom] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const draft = useDraft<CompanyValues>(scope);
  const ready = useRef(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (!draft.loaded || ready.current) return;
    ready.current = true;
    if (draft.saved) {
      setV({ ...EMPTY, ...draft.saved });
      setRestored(true);
    }
  }, [draft.loaded, draft.saved]);
  // First server data arriving after mount (no draft): seed once.
  useEffect(() => {
    if (!company || seeded.current || !draft.loaded) return;
    seeded.current = true;
    if (!draft.saved) setV(initial);
  }, [company, draft.loaded, draft.saved, initial]);

  const set = <K extends keyof CompanyValues>(k: K, val: CompanyValues[K]) => {
    setV((p) => {
      const n = { ...p, [k]: val };
      draft.save(n);
      return n;
    });
  };
  const toggleService = (s: string) => set('services', v.services.includes(s) ? v.services.filter((x) => x !== s) : [...v.services, s]);

  const submit = async () => {
    const e: Record<string, string> = {};
    const req = (k: keyof CompanyValues) => { if (!String(v[k]).trim()) e[k] = ui.t('form.required'); };
    (['name', 'phone', 'contact', 'address', 'city', 'area', 'hours'] as const).forEach(req);
    if (v.services.length === 0) e.services = ui.t('form.servicesRequired');
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await onSubmit({ ...v, name: v.name.trim(), phone: v.phone.trim(), contact: v.contact.trim(), address: v.address.trim(), city: v.city.trim(), area: v.area.trim(), hours: v.hours.trim() });
    if (ok) draft.clear();
  };
  const addCustom = () => {
    const s = custom.trim();
    if (s && !v.services.includes(s) && s.length <= 120) toggleService(s);
    setCustom('');
  };
  const extra = v.services.filter((s) => !(SERVICE_PRESETS as readonly string[]).includes(s));
  const all = !section || section === 'all';

  return (
    <View style={{ gap: 14 }}>
      {restored && (
        <Banner tone="info" icon="save" text={ui.t('form.restored')} actionLabel={ui.t('form.discard')} onAction={() => { draft.clear(); setV(initial); setRestored(false); }} />
      )}
      {errorText ? <Banner tone="error" icon="alert-circle" text={errorText} /> : null}
      {all && (
        <>
          <Field label={ui.t('form.name')} value={v.name} onChangeText={(x) => set('name', x)} error={errors.name} maxLength={200} />
          <SectionTitle>{ui.t('form.type')}</SectionTitle>
          <View style={wrapRow(ui.row)}>
            {(['towing', 'garage', 'both'] as const).map((k) => (
              <Chip key={k} label={ui.t(`ctype.${k}` as never)} selected={v.type === k} onPress={() => set('type', k)} />
            ))}
          </View>
          <Field label={ui.t('form.phone')} value={v.phone} onChangeText={(x) => set('phone', x)} error={errors.phone} keyboardType="phone-pad" ltr maxLength={40} />
          <Field label={ui.t('form.contact')} value={v.contact} onChangeText={(x) => set('contact', x)} error={errors.contact} maxLength={200} />
          <Field label={ui.t('form.address')} value={v.address} onChangeText={(x) => set('address', x)} error={errors.address} multiline maxLength={500} />
          <Field label={ui.t('form.city')} value={v.city} onChangeText={(x) => set('city', x)} error={errors.city} maxLength={120} />
          <Field label={ui.t('form.area')} value={v.area} onChangeText={(x) => set('area', x)} error={errors.area} hint={ui.t('form.areaHint')} maxLength={120} />
        </>
      )}
      {(all || section === 'hours') && (
        <Field label={ui.t('form.hours')} value={v.hours} onChangeText={(x) => set('hours', x)} error={errors.hours} hint={ui.t('form.hoursHint')} multiline maxLength={500} />
      )}
      {(all || section === 'services') && (
        <>
          <SectionTitle>{ui.t('form.services')}</SectionTitle>
          <View style={wrapRow(ui.row)}>
            {SERVICE_PRESETS.map((s) => (
              <Chip key={s} label={ui.t(presetLabelKey(s)!)} selected={v.services.includes(s)} onPress={() => toggleService(s)} icon={v.services.includes(s) ? 'check' : undefined} />
            ))}
            {extra.map((s) => <Chip key={s} label={s} selected onPress={() => toggleService(s)} icon="x" />)}
          </View>
          <Field label={ui.t('form.customService')} value={custom} onChangeText={setCustom} onSubmitEditing={addCustom} returnKeyType="done" maxLength={120} />
          <Button variant="ghost" icon="plus" label={ui.t('form.addService')} onPress={addCustom} disabled={!custom.trim()} />
          {errors.services ? <T v="cap" color="#C7362D">{errors.services}</T> : null}
        </>
      )}
      <Button variant="gold" label={submitLabel} onPress={submit} loading={busy} icon="check" />
    </View>
  );
}
