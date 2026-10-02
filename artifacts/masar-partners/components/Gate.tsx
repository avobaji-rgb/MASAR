import React from 'react';
import { router } from 'expo-router';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { API_BASE, API_URL_INVALID } from '@/lib/config';
import { errKey } from '@/lib/format';
import { Button, EmptyState, ErrorState, Screen, Skeletons } from './ui';

/** Renders loading / config / error / no-company states around company-bound content. */
export function SessionGate({ children, title, tabs, needCompany = true, onBack }: { children: React.ReactNode; title?: string; tabs?: boolean; needCompany?: boolean; onBack?: boolean }) {
  const { t } = useUI();
  const s = useSession();
  if (!API_BASE) {
    return (
      <Screen title={title} tabs={tabs} onBack={onBack}>
        <EmptyState icon="settings" title={t('cfg.apiTitle')} body={API_URL_INVALID ? t('cfg.apiInvalid') : t('cfg.apiMissing')} />
      </Screen>
    );
  }
  if (s.loading) return <Screen title={title} tabs={tabs} onBack={onBack}><Skeletons n={3} /></Screen>;
  if (!s.identity && (s.error as { status?: number } | null)?.status === 404) {
    return (
      <Screen title={title} tabs={tabs} onBack={onBack}>
        <EmptyState icon="settings" title={t('cfg.partnerBackendTitle')} body={t('cfg.partnerBackendBody')}
          action={<Button label={t('common.retry')} onPress={s.refetch} />} />
      </Screen>
    );
  }
  if (!s.identity) return <Screen title={title} tabs={tabs} onBack={onBack}><ErrorState kindText={t(errKey(s.error))} onRetry={s.refetch} /></Screen>;
  if (needCompany && !s.company) {
    return (
      <Screen title={title} tabs={tabs} onBack={onBack}>
        <EmptyState icon="briefcase" title={t('gate.noCompany')} body={t('gate.noCompanyBody')}
          action={<Button variant="gold" icon="plus" label={t('gate.register')} onPress={() => router.push('/register')} />} />
        {s.operator ? <Button variant="ghost" icon="shield" label={t('op.open')} onPress={() => router.push('/operator')} /> : null}
      </Screen>
    );
  }
  return <>{children}</>;
}
