import Constants from 'expo-constants';

function resolveApiBase(): string | null {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      if (u.protocol !== 'https:') return null;
      return u.origin + u.pathname.replace(/\/+$/, '');
    } catch {
      return null;
    }
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  return domain ? `https://${domain}` : null;
}
export const API_BASE = resolveApiBase();
export const API_URL_INVALID = !!process.env.EXPO_PUBLIC_API_URL?.trim() && API_BASE === null;
export const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || null;
export const CLERK_PROXY_URL = process.env.EXPO_PUBLIC_CLERK_PROXY_URL?.trim() || undefined;
export const EAS_PROJECT_ID =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId ||
  null;
export const POLL_MS = 10000;
export const STALE_MS = 5000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
