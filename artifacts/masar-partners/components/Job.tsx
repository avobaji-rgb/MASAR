import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PartnerJob } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { serviceLabelKey } from '@/lib/format';
import { Badge, Banner, Card, T } from './ui';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useCountdown(expiresAt: string) {
  const now = useNow();
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const s = Math.ceil(left / 1000);
  return { left, text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, expired: left <= 0 };
}

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useUI();
  const c = useColors();
  const { text, expired } = useCountdown(expiresAt);
  return (
    <T v="label" color={expired ? c.destructive : c.goldInk}>
      {expired ? t('offer.expired') : t('offer.timeLeft', { time: text })}
    </T>
  );
}

export function serviceLabel(t: ReturnType<typeof useUI>['t'], service: string) {
  const k = serviceLabelKey(service);
  return k ? t(k) : service;
}

export function statusTone(s: string): 'navy' | 'gold' | 'green' | 'red' | 'muted' {
  if (s === 'offered') return 'gold';
  if (s === 'completed') return 'green';
  if (s === 'unavailable' || s === 'declined') return 'red';
  if (s === 'expired') return 'muted';
  return 'navy';
}

export function JobCard({ job }: { job: PartnerJob }) {
  const ui = useUI();
  const c = useColors();
  return (
    <Card onPress={() => router.push(`/job/${encodeURIComponent(job.id)}`)} tone={job.status === 'offered' ? 'gold' : 'plain'}>
      <View style={[ui.row, { justifyContent: 'space-between', alignItems: 'center', gap: 8 }]}>
        <T v="h2" style={{ flex: 1 }}>{serviceLabel(ui.t, job.service)}</T>
        <Badge label={ui.t(`st.${job.status}` as never)} tone={statusTone(job.status)} />
      </View>
      <View style={[ui.row, { gap: 8, alignItems: 'center' }]}>
        <Feather name="map-pin" size={16} color={c.mutedForeground} />
        <T v="small" style={{ flex: 1 }} numberOfLines={2}>{job.location}</T>
      </View>
      {job.status === 'offered' ? <Countdown expiresAt={job.expiresAt} /> : <T v="cap" color={c.mutedForeground}>{ui.fmt(job.updatedAt)}</T>}
    </Card>
  );
}

export function FreshnessBanner({ isError, hasData, dataUpdatedAt, refetch }: { isError: boolean; hasData: boolean; dataUpdatedAt: number; refetch: () => unknown }) {
  const ui = useUI();
  const now = useNow(5000);
  if (!hasData) return null;
  const time = new Date(dataUpdatedAt).toLocaleTimeString(ui.locale === 'ar' ? 'ar-SY' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  if (isError) return <Banner tone="error" text={ui.t('stale.error', { time })} actionLabel={ui.t('common.retry')} onAction={() => void refetch()} />;
  if (now - dataUpdatedAt > 30000) return <Banner tone="warn" text={ui.t('stale.old', { time })} actionLabel={ui.t('common.refresh')} onAction={() => void refetch()} />;
  return null;
}
