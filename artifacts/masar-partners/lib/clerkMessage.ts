import { isClerkAPIResponseError } from '@clerk/expo';
import type { StringKey } from './strings';

export function clerkMessage(e: unknown, t: (k: StringKey) => string): string {
  if (isClerkAPIResponseError(e)) {
    const code = e.errors[0]?.code ?? '';
    if (code === 'form_password_incorrect' || code === 'form_identifier_not_found') return t('auth.errCredentials');
    if (code === 'form_code_incorrect' || code === 'verification_failed') return t('auth.errCode');
    if (code === 'verification_expired') return t('auth.errExpired');
    if (code === 'form_identifier_exists') return t('auth.errExists');
    if (code.startsWith('form_password')) return t('auth.errPassword');
    if (code === 'too_many_requests') return t('auth.errRate');
    return t('auth.errGeneric');
  }
  return t('err.network');
}
