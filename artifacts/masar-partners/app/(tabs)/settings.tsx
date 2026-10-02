import React, { useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useUI, type Locale } from '@/lib/i18n';
import { useAuthState } from '@/lib/auth';
import { useSession } from '@/lib/session';
import { usePush } from '@/lib/push';
import { API_BASE, CLERK_KEY } from '@/lib/config';
import { Banner, Button, Card, Chip, KV, Screen, SectionTitle, SwitchRow, T, wrapRow, success } from '@/components/ui';

export default function Settings() {
  const ui = useUI();
  const c = useColors();
  const auth = useAuthState();
  const s = useSession();
  const push = usePush();
  const qc = useQueryClient();
  const [out, setOut] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const setPush = async (on: boolean) => {
    setPushMsg(null);
    if (on) {
      const r = await push.enable();
      if (r === 'ok') success();
      else setPushMsg(r === 'denied' ? ui.t('push.denied') : ui.t('push.failed'));
    } else if (!(await push.disable())) setPushMsg(ui.t('push.removeFailed'));
  };
  const signOut = async () => {
    setOut(true);
    const ok = await push.unregisterForSignOut();
    if (!ok) {
      setPushMsg(ui.t('push.removeFailed'));
      Alert.alert(ui.t('set.unregFail'), ui.t('set.unregFailBody'));
      setOut(false);
      return;
    }
    qc.clear();
    try { await auth.signOut(); } finally { setOut(false); }
  };
  const confirmSignOut = () => {
    if (Platform.OS === 'web') { void signOut(); return; }
    Alert.alert(ui.t('set.signOut'), ui.t('set.signOutBody'), [
      { text: ui.t('common.cancel'), style: 'cancel' },
      { text: ui.t('set.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };
  const pushUnavailable = push.availability !== 'ok' && push.availability !== 'checking' ? ui.t(`push.na.${push.availability}` as never) : null;

  return (
    <Screen tabs title={ui.t('tab.settings')}>
      <SectionTitle>{ui.t('set.language')}</SectionTitle>
      <View style={wrapRow(ui.row)}>
        {(['ar', 'en'] as Locale[]).map((l) => (
          <Chip key={l} label={l === 'ar' ? 'العربية' : 'English'} selected={ui.locale === l} onPress={() => ui.setLocale(l)} />
        ))}
      </View>

      <SectionTitle>{ui.t('set.push')}</SectionTitle>
      <Card>
        {pushUnavailable ? (
          <Banner tone="info" icon="bell-off" text={pushUnavailable} />
        ) : (
          <SwitchRow title={ui.t('set.pushToggle')} body={ui.t('set.pushBody')} value={push.enabled} onValueChange={setPush} busy={push.busy} disabled={push.availability === 'checking'} />
        )}
        {push.denied ? (
          <Button variant="ghost" icon="settings" label={ui.t('push.openSettings')} onPress={() => void Linking.openSettings().catch(() => {})} />
        ) : null}
        {pushMsg ? <T v="small" color={c.destructive}>{pushMsg}</T> : null}
      </Card>

      {s.companies.length > 1 && (
        <>
          <SectionTitle>{ui.t('set.company')}</SectionTitle>
          <View style={wrapRow(ui.row)}>
            {s.companies.map((x) => <Chip key={x.id} label={x.name} selected={x.id === s.company?.id} onPress={() => s.selectCompany(x.id)} />)}
          </View>
        </>
      )}
      {s.operator && (
        <>
          <SectionTitle>{ui.t('set.operator')}</SectionTitle>
          <Button variant="gold" icon="shield" label={ui.t('op.open')} onPress={() => router.push('/operator')} />
        </>
      )}

      <SectionTitle>{ui.t('set.account')}</SectionTitle>
      <Card>
        <KV k={ui.t('set.userId')} v={auth.userId} ltr />
        <KV k={ui.t('set.role')} v={s.role ? ui.t(`role.${s.role}` as never) : s.operator ? ui.t('set.operator') : '-'} />
        <KV k={ui.t('set.server')} v={API_BASE ? API_BASE.replace(/^https:\/\//, '') : ui.t('set.notConfigured')} ltr />
        <KV k={ui.t('set.auth')} v={CLERK_KEY ? ui.t('set.active') : ui.t('set.notConfigured')} />
      </Card>
      <Button variant="danger" icon="log-out" label={ui.t('set.signOut')} onPress={confirmSignOut} loading={out} />
    </Screen>
  );
}
