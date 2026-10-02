import React, { useState } from 'react';
import { router } from 'expo-router';
import { useSignIn } from '@clerk/expo';
import { clerkMessage } from '@/lib/clerkMessage';
import { useUI } from '@/lib/i18n';
import { CLERK_KEY } from '@/lib/config';
import { AuthUnavailable } from '@/components/AuthUnavailable';
import { Banner, Button, Field, Screen, T, success, warn } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

export default function SignInScreen() {
  if (!CLERK_KEY) return <AuthUnavailable />;
  return <SignInForm />;
}

type Step = 'form' | 'code' | 'reset' | 'resetCode';

function SignInForm() {
  const ui = useUI();
  const c = useColors();
  const { signIn, fetchStatus } = useSignIn();
  const [step, setStep] = useState<Step>('form');
  const [secondFactor, setSecondFactor] = useState<'email_code' | 'totp'>('email_code');
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
  const finish = async () => {
    if (signIn.status === 'complete') {
      const { error } = await signIn.finalize({
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
      return;
    }
    if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
      const factors = signIn.supportedSecondFactors ?? [];
      if (factors.some((f) => f.strategy === 'email_code')) {
        const { error } = await signIn.mfa.sendEmailCode();
        if (error) throw error;
        setSecondFactor('email_code');
      } else if (factors.some((f) => f.strategy === 'totp')) {
        setSecondFactor('totp');
      } else {
        setErr(ui.t('auth.errSessionTask'));
        return;
      }
      setCode('');
      setStep('code');
      return;
    }
    setErr(ui.t('auth.errGeneric'));
  };
  const submit = () => run(async () => {
    const { error } = await signIn.password({ emailAddress: email.trim(), password });
    if (error) throw error;
    await finish();
  });
  const verify = () => run(async () => {
    const { error } = secondFactor === 'totp'
      ? await signIn.mfa.verifyTOTP({ code: code.trim() })
      : await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (error) throw error;
    await finish();
  });
  const sendReset = () => run(async () => {
    const { error: createError } = await signIn.create({ identifier: email.trim() });
    if (createError) throw createError;
    const { error } = await signIn.resetPasswordEmailCode.sendCode();
    if (error) throw error;
    setCode('');
    setPassword('');
    setStep('resetCode');
  });
  const doReset = () => run(async () => {
    if (signIn.status !== 'needs_new_password') {
      const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (verifyError) throw verifyError;
    }
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (error) throw error;
    await finish();
  });

  const emailField = <Field label={ui.t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} textContentType="username" ltr />;
  return (
    <Screen onBack title={step === 'form' ? ui.t('auth.signIn') : step === 'code' ? ui.t(secondFactor === 'totp' ? 'auth.authenticatorTitle' : 'auth.verifyTitle') : ui.t('auth.resetTitle')}>
      {err ? <Banner tone="error" icon="alert-circle" text={err} /> : null}
      {step === 'form' && (
        <>
          {emailField}
          <Field label={ui.t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" ltr />
          <Button variant="gold" label={ui.t('auth.signIn')} icon="log-in" onPress={submit} loading={busy} disabled={!email.trim() || !password} />
          <Button variant="ghost" label={ui.t('auth.forgot')} onPress={() => { setErr(null); setStep('reset'); }} />
          <Button variant="ghost" label={ui.t('auth.noAccount')} onPress={() => router.replace('/sign-up')} />
          <T v="cap" color={c.mutedForeground}>{ui.t('auth.sameAccount')}</T>
        </>
      )}
      {step === 'code' && (
        <>
          <T v="small" color={c.mutedForeground}>{secondFactor === 'totp' ? ui.t('auth.authenticatorBody') : ui.t('auth.codeSent', { email })}</T>
          <Field label={ui.t('auth.code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" ltr />
          <Button variant="gold" label={ui.t('auth.verify')} icon="check" onPress={verify} loading={busy} disabled={code.trim().length < 4} />
          {secondFactor === 'email_code' ? <Button variant="ghost" label={ui.t('auth.resend')} onPress={() => run(async () => {
            const { error } = await signIn.mfa.sendEmailCode();
            if (error) throw error;
          })} /> : null}
        </>
      )}
      {step === 'reset' && (
        <>
          <T v="small" color={c.mutedForeground}>{ui.t('auth.resetBody')}</T>
          {emailField}
          <Button variant="gold" label={ui.t('auth.sendCode')} icon="mail" onPress={sendReset} loading={busy} disabled={!email.trim()} />
          <Button variant="ghost" label={ui.t('common.back')} onPress={() => setStep('form')} />
        </>
      )}
      {step === 'resetCode' && (
        <>
          <T v="small" color={c.mutedForeground}>{ui.t('auth.codeSent', { email })}</T>
          <Field label={ui.t('auth.code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" ltr />
          <Field label={ui.t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" ltr />
          <Button variant="gold" label={ui.t('auth.resetDo')} icon="check" onPress={doReset} loading={busy} disabled={code.trim().length < 4 || password.length < 8} />
        </>
      )}
    </Screen>
  );
}
