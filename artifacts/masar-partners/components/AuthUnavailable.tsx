import React from 'react';
import { useUI } from '@/lib/i18n';
import { EmptyState, Screen, Banner } from './ui';

export function AuthUnavailable({ apiToo }: { apiToo?: boolean }) {
  const { t } = useUI();
  return (
    <Screen onBack title={t('auth.unavailableTitle')}>
      <EmptyState icon="key" title={t('auth.unavailableTitle')} body={t('auth.unavailableBody')} />
      <Banner tone="info" text={t('auth.unavailableHint')} />
      {apiToo ? <Banner tone="warn" text={t('cfg.apiMissing')} /> : null}
    </Screen>
  );
}
