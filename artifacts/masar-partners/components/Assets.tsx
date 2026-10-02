import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { getGetPartnerAssetQueryKey, useGetPartnerAsset } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { Banner, Button, T } from './ui';

const isUrl = (v: string) => /^https:\/\//i.test(v);

/** Logo/photo: direct https URLs render as-is, stored asset ids are resolved through the authorized asset endpoint. */
export function AssetImage({ companyId, value, size }: { companyId: string; value: string; size: number }) {
  const c = useColors();
  const q = useGetPartnerAsset(companyId, encodeURIComponent(value), {
    query: { queryKey: getGetPartnerAssetQueryKey(companyId, encodeURIComponent(value)), enabled: !isUrl(value), staleTime: 4 * 60 * 1000, gcTime: 5 * 60 * 1000 },
  });
  const uri = isUrl(value) ? value : q.data?.url;
  return (
    <View style={{ width: size, height: size, borderRadius: size > 70 ? 18 : 18, overflow: 'hidden', backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} /> : <Feather name={q.isError ? 'image' : 'loader'} size={22} color={c.mutedForeground} />}
    </View>
  );
}

/** Private document: signed URL fetched only on demand, never cached long. */
export function DocRow({ companyId, value, index }: { companyId: string; value: string; index: number }) {
  const ui = useUI();
  const c = useColors();
  const [err, setErr] = useState(false);
  const q = useGetPartnerAsset(companyId, encodeURIComponent(value), {
    query: { queryKey: getGetPartnerAssetQueryKey(companyId, encodeURIComponent(value)), enabled: false, staleTime: 0, gcTime: 60 * 1000 },
  });
  const open = async () => {
    setErr(false);
    const r = await q.refetch();
    if (r.data?.url) await Linking.openURL(r.data.url).catch(() => setErr(true));
    else setErr(true);
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.row, { alignItems: 'center', gap: 12 }]}>
        <Feather name="file-text" size={22} color={c.primary} />
        <T v="body" style={{ flex: 1 }}>{ui.t('media.docN', { n: index + 1 })}</T>
        <Button variant="ghost" label={ui.t('media.view')} onPress={open} loading={q.isFetching} style={{ minHeight: 48 }} />
      </View>
      {err ? <Banner tone="error" text={ui.t('media.viewFail')} /> : null}
    </View>
  );
}
