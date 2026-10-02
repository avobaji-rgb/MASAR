import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthState } from './auth';

/** Unsent company-form drafts, scoped per user and company. Never used for passwords. */
export function useDraft<T>(scope: string) {
  const { userId } = useAuthState();
  const key = userId ? `masar.draft.${userId}.${scope}` : null;
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    if (!key) {
      setLoaded(true);
      return;
    }
    AsyncStorage.getItem(key)
      .then((v) => {
        if (alive && v) setSaved(JSON.parse(v) as T);
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key]);

  const save = useCallback(
    (value: T) => {
      if (!key) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
      }, 400);
    },
    [key],
  );
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSaved(null);
    if (key) AsyncStorage.removeItem(key).catch(() => {});
  }, [key]);
  return { loaded, saved, save, clear };
}
