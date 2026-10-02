import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, ar, type StringKey } from './strings';

export type Locale = 'ar' | 'en';
const KEY = 'masar.locale';

export async function loadLocale(): Promise<Locale> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

type FontWeight = 'regular' | 'medium' | 'bold';
type Ctx = {
  locale: Locale;
  rtl: boolean;
  setLocale: (l: Locale) => void;
  t: (k: StringKey, p?: Record<string, string | number>) => string;
  font: (w: FontWeight) => string;
  row: { flexDirection: 'row' | 'row-reverse' };
  start: 'flex-start' | 'flex-end';
  align: 'left' | 'right';
  chevron: 'chevron-left' | 'chevron-right';
  back: 'arrow-left' | 'arrow-right';
  fmt: (iso: string | null | undefined) => string;
};
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ initial, children, fontsReady = true }: { initial: Locale; children: React.ReactNode; fontsReady?: boolean }) {
  const [locale, setL] = useState<Locale>(initial);
  const setLocale = useCallback((l: Locale) => {
    setL(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => {
    const rtl = locale === 'ar';
    const flip = rtl !== I18nManager.isRTL;
    const dict: Record<string, string> = locale === 'ar' ? ar : en;
    const fam = locale === 'ar' ? 'NotoSansArabic' : 'DMSans';
    const suffix = { regular: '400Regular', medium: '500Medium', bold: '700Bold' };
    return {
      locale,
      rtl,
      setLocale,
      t: (k, p) => {
        let s = dict[k] ?? k;
        if (p) for (const [n, v] of Object.entries(p)) s = s.split(`{${n}}`).join(String(v));
        return s;
      },
      font: (w) => fontsReady ? `${fam}_${suffix[w]}` : Platform.OS === 'ios' ? 'System' : 'sans-serif',
      row: { flexDirection: flip ? 'row-reverse' : 'row' },
      start: flip ? 'flex-end' : 'flex-start',
      align: rtl ? 'right' : 'left',
      chevron: rtl ? 'chevron-left' : 'chevron-right',
      back: rtl ? 'arrow-right' : 'arrow-left',
      fmt: (iso) => {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '-';
        try {
          return d.toLocaleString(locale === 'ar' ? 'ar-SY' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
        } catch {
          return d.toISOString();
        }
      },
    };
  }, [locale, setLocale, fontsReady]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useUI(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useUI outside I18nProvider');
  return c;
}
