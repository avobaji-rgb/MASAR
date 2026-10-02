import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSignUp } from '@clerk/expo';
import { useUI } from '@/lib/i18n';
import { CLERK_KEY } from '@/lib/config';
import { AuthUnavailable } from '@/components/AuthUnavailable';
import { Banner, Button, Field, Screen, T, success, warn } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { clerkMessage } from '@/lib/clerkMessage';

export default function SignUpScreen() {
  if (!CLERK_KEY) return <AuthUnavailable />;
  return <SignUpForm />;
}

function SignUpForm() {
  const ui = useUI();
  const c = useColors();
  const { signUp, fetchStatus } = useSignUp();
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    if (fetchStatus === 'fetching' || busy) return;
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e) { warn(); setErr(clerkMessage(e, ui.t)); } finally { setBusy(false); }
  };
  const create = () => run(async () => {
    const { error: createError } = await signUp.password({ emailAddress: email.trim(), password });
    if (createError) throw createError;
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) throw error;
    setPassword('');
    setPending(true);
  });
  const verify = () => run(async () => {
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (verifyError) throw verifyError;
    if (signUp.status === 'complete') {
      const { error } = await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) {
            setErr(ui.t('auth.errSessionTask'));
            return;
          }
          success();
          router.replace('/(tabs)');
        },
      });
      if (error) throw error;
    } else setErr(ui.t('auth.errGeneric'));
  });

  return (
    <Screen onBack title={pending ? ui.t('auth.verifyTitle') : ui.t('auth.signUp')}>
      {err ? <Banner tone="error" icon="alert-circle" text={err} /> : null}
      {!pending ? (
        <>
          <T v="small" color={c.mutedForeground}>{ui.t('auth.signUpBody')}</T>
          <Field label={ui.t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} ltr />
          <Field label={ui.t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" hint={ui.t('auth.passwordHint')} ltr />
          <Button variant="gold" label={ui.t('auth.signUp')} icon="user-plus" onPress={create} loading={busy} disabled={!email.trim() || password.length < 8} />
          <Button variant="ghost" label={ui.t('auth.haveAccount')} onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <>
          <T v="small" color={c.mutedForeground}>{ui.t('auth.codeSent', { email })}</T>
          <Field label={ui.t('auth.code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" ltr />
          <Button variant="gold" label={ui.t('auth.verify')} icon="check" onPress={verify} loading={busy} disabled={code.trim().length < 4} />
          <Button variant="ghost" label={ui.t('auth.resend')} onPress={() => run(async () => {
            const { error } = await signUp.verifications.sendEmailCode();
            if (error) throw error;
          })} />
          <Button variant="ghost" label={ui.t('auth.changeEmail')} onPress={() => { setPending(false); setCode(''); setErr(null); }} />
        </>
      )}
      <View nativeID="clerk-captcha" />
    </Screen>
  );
}
