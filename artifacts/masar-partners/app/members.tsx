import React, { useState } from 'react';
import { View } from 'react-native';
import { getListPartnerMembersQueryKey, useAddPartnerMember, useListPartnerMembers, useUpdatePartnerMember, type PartnerMember } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useDraft } from '@/lib/drafts';
import { POLL_MS, STALE_MS } from '@/lib/config';
import { errKey } from '@/lib/format';
import { SessionGate } from '@/components/Gate';
import { FreshnessBanner } from '@/components/Job';
import { Badge, Banner, Button, Card, Chip, EmptyState, ErrorState, Field, Screen, SectionTitle, SwitchRow, T, Skeletons, success, warn, wrapRow } from '@/components/ui';

export default function Members() {
  return <SessionGate onBack><Content /></SessionGate>;
}

type Assignable = 'planner' | 'worker';

function Content() {
  const ui = useUI();
  const c = useColors();
  const s = useSession();
  const qc = useQueryClient();
  const company = s.company!;
  const key = getListPartnerMembersQueryKey(company.id);
  const q = useListPartnerMembers(company.id, { query: { queryKey: key, enabled: s.role !== 'worker', refetchInterval: POLL_MS, staleTime: STALE_MS } });
  const add = useAddPartnerMember();
  const upd = useUpdatePartnerMember();
  const draft = useDraft<{ userId: string; role: Assignable }>(`member.${company.id}`);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Assignable>('worker');
  const [err, setErr] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [eRole, setERole] = useState<Assignable>('worker');
  const [eActive, setEActive] = useState(true);
  const owner = s.isOwner;

  if (draft.loaded && !seeded) {
    setSeeded(true);
    if (draft.saved) { setUserId(draft.saved.userId); setRole(draft.saved.role); }
  }
  if (s.role === 'worker') return <Screen onBack title={ui.t('company.members')}><Banner tone="warn" text={ui.t('err.forbidden')} /></Screen>;

  const submitAdd = async () => {
    setErr(null);
    try {
      await add.mutateAsync({ companyId: company.id, data: { userId: userId.trim(), role } });
      success();
      setUserId('');
      draft.clear();
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      warn();
      const st = (e as { status?: number }).status;
      setErr(st === 404 || st === 422 ? ui.t('mem.notFound') : ui.t(errKey(e)));
    }
  };
  const startEdit = (m: PartnerMember) => { setEditing(m.id); setERole(m.role === 'planner' ? 'planner' : 'worker'); setEActive(m.active); setErr(null); };
  const saveEdit = async (m: PartnerMember, active = eActive) => {
    setErr(null);
    try {
      const updated = await upd.mutateAsync({ companyId: company.id, memberId: m.id, data: { role: eRole, active } });
      qc.setQueryData<PartnerMember[]>(key, (old) => old?.map((x) => (x.id === updated.id ? updated : x)));
      success();
      setEditing(null);
    } catch (e) { warn(); setErr(ui.t(errKey(e))); void q.refetch(); }
  };

  return (
    <Screen onBack title={ui.t('company.members')} subtitle={company.name} onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading}>
      <FreshnessBanner isError={q.isError} hasData={!!q.data} dataUpdatedAt={q.dataUpdatedAt} refetch={q.refetch} />
      {err ? <Banner tone="error" icon="alert-circle" text={err} /> : null}
      {q.isLoading ? <Skeletons n={3} height={90} /> : q.isError && !q.data ? <ErrorState kindText={ui.t(errKey(q.error))} onRetry={() => void q.refetch()} /> :
        (q.data ?? []).length === 0 ? <EmptyState icon="users" title={ui.t('mem.empty')} body={ui.t('mem.emptyBody')} /> :
        (q.data ?? []).map((m) => {
          const isOwnerRow = m.role === 'owner';
          return (
            <Card key={m.id}>
              <View style={[ui.row, { justifyContent: 'space-between', alignItems: 'center', gap: 8 }]}>
                <View style={{ flex: 1 }}>
                  <T v="body" w="bold">{m.name || m.userId}</T>
                  <T v="cap" color={c.mutedForeground} style={{ writingDirection: 'ltr' }} selectable>{m.userId}</T>
                </View>
                <Badge label={ui.t(`role.${m.role}` as never)} tone={isOwnerRow ? 'gold' : 'navy'} />
              </View>
              {!m.active && <Badge label={ui.t('mem.inactive')} tone="muted" />}
              {owner && !isOwnerRow && editing !== m.id && (
                <View style={[ui.row, { gap: 10 }]}>
                  <Button variant="ghost" icon="edit-2" label={ui.t('common.edit')} onPress={() => startEdit(m)} style={{ flex: 1 }} />
                  <Button variant={m.active ? 'ghost' : 'gold'} icon={m.active ? 'user-x' : 'user-check'} label={m.active ? ui.t('mem.deactivate') : ui.t('mem.reactivate')}
                    onPress={() => { setERole(m.role === 'planner' ? 'planner' : 'worker'); void saveEdit(m, !m.active); }} style={{ flex: 1 }} loading={upd.isPending} />
                </View>
              )}
              {editing === m.id && (
                <View style={{ gap: 10 }}>
                  <View style={wrapRow(ui.row)}>
                    {(['planner', 'worker'] as const).map((r) => <Chip key={r} label={ui.t(`role.${r}` as never)} selected={eRole === r} onPress={() => setERole(r)} />)}
                  </View>
                  <SwitchRow title={ui.t('mem.active')} value={eActive} onValueChange={setEActive} />
                  <View style={[ui.row, { gap: 10 }]}>
                    <Button variant="ghost" label={ui.t('common.cancel')} onPress={() => setEditing(null)} style={{ flex: 1 }} />
                    <Button variant="gold" label={ui.t('common.save')} onPress={() => void saveEdit(m)} loading={upd.isPending} style={{ flex: 1 }} />
                  </View>
                </View>
              )}
            </Card>
          );
        })}

      {owner ? (
        <>
          <SectionTitle>{ui.t('mem.add')}</SectionTitle>
          <Card>
            <T v="small" color={c.mutedForeground}>{ui.t('mem.addBody')}</T>
            <Field label={ui.t('mem.userId')} value={userId} onChangeText={(x) => { setUserId(x); draft.save({ userId: x, role }); }} autoCapitalize="none" autoCorrect={false} ltr placeholder="user_..." />
            <View style={wrapRow(ui.row)}>
              {(['planner', 'worker'] as const).map((r) => <Chip key={r} label={ui.t(`role.${r}` as never)} selected={role === r} onPress={() => { setRole(r); draft.save({ userId, role: r }); }} />)}
            </View>
            <T v="cap" color={c.mutedForeground}>{ui.t('mem.noOwner')}</T>
            <Button variant="gold" icon="user-plus" label={ui.t('mem.add')} onPress={submitAdd} loading={add.isPending} disabled={!userId.trim()} />
          </Card>
        </>
      ) : <Banner tone="info" text={ui.t('mem.ownerOnly')} />}
    </Screen>
  );
}
