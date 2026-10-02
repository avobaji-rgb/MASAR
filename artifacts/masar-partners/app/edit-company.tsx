import React, { useState } from 'react';
import { router } from 'expo-router';
import { getGetPartnerCompanyQueryKey, useGetPartnerCompany, useUpdatePartnerCompany } from '@workspace/api-client-react';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { errKey } from '@/lib/format';
import { SessionGate } from '@/components/Gate';
import { CompanyForm } from '@/components/CompanyForm';
import { Banner, Screen, Skeletons, success, warn } from '@/components/ui';

export default function EditCompany() {
  return <SessionGate onBack><Content /></SessionGate>;
}

function Content() {
  const ui = useUI();
  const s = useSession();
  const base = s.company!;
  const q = useGetPartnerCompany(base.id, { query: { queryKey: getGetPartnerCompanyQueryKey(base.id), staleTime: 0 } });
  const upd = useUpdatePartnerCompany();
  const [err, setErr] = useState<string | null>(null);
  const company = q.data ?? base;
  const allowed = s.role === 'owner' || s.role === 'planner';
  if (!allowed) return <Screen onBack title={ui.t('company.edit')}><Banner tone="warn" text={ui.t('err.forbidden')} /></Screen>;
  return (
    <Screen onBack title={ui.t('company.edit')} subtitle={company.name}>
      {company.status !== 'approved' && <Banner tone="info" text={ui.t('edit.notApprovedNote')} />}
      {q.isLoading ? <Skeletons n={4} height={60} /> : (
        <CompanyForm key={company.id} scope={`edit.${company.id}`} company={company} submitLabel={ui.t('common.save')} busy={upd.isPending} errorText={err}
          onSubmit={async (data) => {
            setErr(null);
            try {
              const updated = await upd.mutateAsync({ companyId: company.id, data: { ...data, expectedVersion: company.version } });
              s.patchCompany(updated);
              success();
              router.back();
              return true;
            } catch (e) {
              warn();
              setErr(ui.t(errKey(e)));
              void q.refetch();
              return false;
            }
          }} />
      )}
    </Screen>
  );
}
