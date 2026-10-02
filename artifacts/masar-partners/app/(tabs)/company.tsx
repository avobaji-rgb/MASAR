import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useGetPartnerCompany, getGetPartnerCompanyQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { initials, presetLabelKey } from '@/lib/format';
import { SessionGate } from '@/components/Gate';
import { AssetImage } from '@/components/Assets';
import { Badge, Button, Card, KV, Screen, SectionTitle, T, Chip, wrapRow } from '@/components/ui';

export default function CompanyTab() {
  const { t } = useUI();
  return (
    <SessionGate tabs title={t('tab.company')}>
      <Content />
    </SessionGate>
  );
}

function Content() {
  const ui = useUI();
  const c = useColors();
  const s = useSession();
  const base = s.company!;
  const fresh = useGetPartnerCompany(base.id, { query: { queryKey: getGetPartnerCompanyQueryKey(base.id), staleTime: 5000 } });
  const company = fresh.data && fresh.data.version >= base.version ? fresh.data : base;
  const canEdit = s.role === 'owner' || s.role === 'planner';
  return (
    <Screen tabs title={ui.t('tab.company')} onRefresh={() => { s.refetch(); void fresh.refetch(); }} refreshing={fresh.isFetching}>
      <Card style={{ gap: 12 }}>
        <View style={[ui.row, { gap: 14, alignItems: 'center' }]}>
          {company.logo ? (
            <AssetImage companyId={company.id} value={company.logo} size={64} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center' }}>
              <T v="title" color={c.secondaryForeground}>{initials(company.name)}</T>
            </View>
          )}
          <View style={{ flex: 1, gap: 6 }}>
            <T v="h2">{company.name}</T>
            <Badge label={ui.t(`cs.${company.status}` as never)} tone={company.status === 'approved' ? 'green' : company.status === 'pending' ? 'gold' : 'red'} />
          </View>
        </View>
        <KV k={ui.t('form.type')} v={ui.t(`ctype.${company.type}` as never)} />
        <KV k={ui.t('form.phone')} v={company.phone} ltr />
        <KV k={ui.t('form.contact')} v={company.contact} />
        <KV k={ui.t('form.address')} v={`${company.address}, ${company.area}, ${company.city}`} />
        <KV k={ui.t('form.hours')} v={company.hours} />
      </Card>
      <SectionTitle>{ui.t('form.services')}</SectionTitle>
      <View style={wrapRow(ui.row)}>
        {company.services.map((x) => { const k = presetLabelKey(x); return <Chip key={x} label={k ? ui.t(k) : x} selected />; })}
      </View>
      {company.photos.length > 0 && (
        <>
          <SectionTitle>{ui.t('media.photos')}</SectionTitle>
          <View style={wrapRow(ui.row)}>
            {company.photos.map((p) => <AssetImage key={p} companyId={company.id} value={p} size={96} />)}
          </View>
        </>
      )}
      {canEdit ? (
        <>
          <Button variant="gold" icon="edit-3" label={ui.t('company.edit')} onPress={() => router.push('/edit-company')} />
          <Button variant="ghost" icon="image" label={ui.t('company.media')} onPress={() => router.push('/media')} />
        </>
      ) : null}
      {s.role !== 'worker' && <Button variant="ghost" icon="users" label={ui.t('company.members')} onPress={() => router.push('/members')} />}
      <Button variant="ghost" icon="plus" label={ui.t('company.registerAnother')} onPress={() => router.push('/register')} />
    </Screen>
  );
}
