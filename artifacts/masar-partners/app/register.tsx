import React, { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPartnerIdentityQueryKey, useRegisterPartnerCompany } from '@workspace/api-client-react';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { errKey } from '@/lib/format';
import { CompanyForm } from '@/components/CompanyForm';
import { Banner, Screen, success, warn } from '@/components/ui';

export default function Register() {
  const ui = useUI();
  const s = useSession();
  const qc = useQueryClient();
  const reg = useRegisterPartnerCompany();
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen onBack title={ui.t('reg.title')} subtitle={ui.t('reg.subtitle')}>
      <Banner tone="info" text={ui.t('reg.notice')} />
      <CompanyForm scope="new" submitLabel={ui.t('reg.submit')} busy={reg.isPending} errorText={err}
        onSubmit={async (data) => {
          setErr(null);
          try {
            const created = await reg.mutateAsync({ data });
            success();
            await qc.invalidateQueries({ queryKey: getGetPartnerIdentityQueryKey() });
            s.selectCompany(created.id);
            router.replace('/');
            return true;
          } catch (e) {
            warn();
            setErr(ui.t(errKey(e)));
            return false;
          }
        }} />
    </Screen>
  );
}
