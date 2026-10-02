import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRegisterPartnerDevice, useRemovePartnerDevice } from '@workspace/api-client-react';
import { EAS_PROJECT_ID } from './config';
import { useAuthState } from './auth';

export type PushAvailability = 'ok' | 'web' | 'expogo' | 'simulator' | 'noproject';
type Notif = typeof import('expo-notifications');

async function loadNotifications(): Promise<Notif | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}
async function availability(): Promise<PushAvailability> {
  if (Platform.OS === 'web') return 'web';
  if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') return 'expogo';
  try {
    const Device = await import('expo-device');
    if (!Device.isDevice) return 'simulator';
  } catch {
    return 'simulator';
  }
  if (!EAS_PROJECT_ID) return 'noproject';
  return 'ok';
}

type PushCtx = {
  availability: PushAvailability | 'checking';
  enabled: boolean;
  denied: boolean;
  busy: boolean;
  enable: () => Promise<'ok' | 'denied' | 'failed'>;
  disable: () => Promise<boolean>;
  /** Returns false when the server could not unregister the device. */
  unregisterForSignOut: () => Promise<boolean>;
};
const Ctx = createContext<PushCtx | null>(null);

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn } = useAuthState();
  const router = useRouter();
  const [avail, setAvail] = useState<PushAvailability | 'checking'>('checking');
  const [enabled, setEnabled] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const register = useRegisterPartnerDevice();
  const remove = useRemovePartnerDevice();
  const tokenKey = userId ? `masar.push.token.${userId}` : null;

  useEffect(() => {
    availability().then(setAvail);
  }, []);

  const getToken = useCallback(async (N: Notif, ask: boolean): Promise<string | 'denied'> => {
    let perm = await N.getPermissionsAsync();
    if (perm.status !== 'granted' && ask) perm = await N.requestPermissionsAsync();
    if (perm.status !== 'granted') return 'denied';
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('offers', { name: 'Offers', importance: N.AndroidImportance.HIGH });
    }
    const t = await N.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID as string });
    return t.data;
  }, []);

  // Restore state and refresh the token silently when previously enabled.
  useEffect(() => {
    if (!tokenKey || !isSignedIn || avail !== 'ok') {
      setEnabled(false);
      return;
    }
    let alive = true;
    (async () => {
      const stored = await AsyncStorage.getItem(tokenKey);
      if (!stored || !alive) return;
      setEnabled(true);
      const N = await loadNotifications();
      if (!N) return;
      const fresh = await getToken(N, false);
      if (fresh !== 'denied' && fresh !== stored) {
        await register.mutateAsync({ data: { token: fresh, platform: Platform.OS === 'ios' ? 'ios' : 'android' } });
        await AsyncStorage.setItem(tokenKey, fresh);
      }
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenKey, isSignedIn, avail]);

  // Foreground presentation + deep link (job id only, no payload content).
  useEffect(() => {
    if (!isSignedIn || avail !== 'ok') return;
    let remover: { remove: () => void } | null = null;
    let alive = true;
    loadNotifications().then(async (N) => {
      if (!N || !alive) return;
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });
      const open = (data: unknown) => {
        const id = (data as { jobId?: unknown } | null)?.jobId;
        if (typeof id === 'string' && id) router.push(`/job/${encodeURIComponent(id)}`);
      };
      remover = N.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
      const last = await Promise.resolve(N.getLastNotificationResponse());
      if (last) open(last.notification.request.content.data);
    });
    return () => {
      alive = false;
      remover?.remove();
    };
  }, [isSignedIn, avail, router]);

  const enable = useCallback(async () => {
    if (avail !== 'ok' || !tokenKey) return 'failed' as const;
    setBusy(true);
    try {
      const N = await loadNotifications();
      if (!N) return 'failed' as const;
      const tok = await getToken(N, true);
      if (tok === 'denied') {
        setDenied(true);
        return 'denied' as const;
      }
      setDenied(false);
      await register.mutateAsync({ data: { token: tok, platform: Platform.OS === 'ios' ? 'ios' : 'android' } });
      await AsyncStorage.setItem(tokenKey, tok);
      setEnabled(true);
      return 'ok' as const;
    } catch {
      return 'failed' as const;
    } finally {
      setBusy(false);
    }
  }, [avail, tokenKey, getToken, register]);

  const disable = useCallback(async () => {
    if (!tokenKey) return true;
    const tok = await AsyncStorage.getItem(tokenKey);
    if (!tok) {
      setEnabled(false);
      return true;
    }
    setBusy(true);
    try {
      await remove.mutateAsync({ data: { token: tok } });
      await AsyncStorage.removeItem(tokenKey);
      setEnabled(false);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [tokenKey, remove]);

  const unregisterForSignOut = useCallback(async () => {
    if (!tokenKey) return true;
    const tok = await AsyncStorage.getItem(tokenKey);
    if (!tok) return true;
    try {
      await remove.mutateAsync({ data: { token: tok } });
      await AsyncStorage.removeItem(tokenKey);
      return true;
    } catch {
      return false;
    }
  }, [tokenKey, remove]);

  const value = useMemo(
    () => ({ availability: avail, enabled, denied, busy, enable, disable, unregisterForSignOut }),
    [avail, enabled, denied, busy, enable, disable, unregisterForSignOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function usePush(): PushCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePush outside PushProvider');
  return c;
}
