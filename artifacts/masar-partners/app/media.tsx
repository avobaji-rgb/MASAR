import React, { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { fetch as uploadFetch } from 'expo/fetch';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPartnerCompanyQueryKey, useConfirmPartnerUpload, useGetPartnerCompany, useGetPartnerUpload, type PartnerUploadInputKind,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { MAX_DOC_BYTES, MAX_IMAGE_BYTES } from '@/lib/config';
import { errKey } from '@/lib/format';
import { SessionGate } from '@/components/Gate';
import { AssetImage, DocRow } from '@/components/Assets';
import { Banner, Button, Card, Screen, SectionTitle, T, success, warn, wrapRow } from '@/components/ui';

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
type Picked = { uri: string; name: string; type: string; size?: number; kind: PartnerUploadInputKind };

export default function Media() {
  return <SessionGate onBack><Content /></SessionGate>;
}

function Content() {
  const ui = useUI();
  const c = useColors();
  const s = useSession();
  const qc = useQueryClient();
  const base = s.company!;
  const q = useGetPartnerCompany(base.id, { query: { queryKey: getGetPartnerCompanyQueryKey(base.id), staleTime: 0 } });
  const company = q.data ?? base;
  const getUpload = useGetPartnerUpload();
  const confirm = useConfirmPartnerUpload();
  const [busy, setBusy] = useState<PartnerUploadInputKind | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'info'; text: string; settings?: boolean } | null>(null);
  const [retry, setRetry] = useState<Picked | null>(null);
  const allowed = s.role === 'owner';

  const upload = async (p: Picked) => {
    setMsg(null);
    setRetry(null);
    const types = p.kind === 'document' ? DOC_TYPES : IMG_TYPES;
    const max = p.kind === 'document' ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
    if (!types.includes(p.type)) { setMsg({ tone: 'error', text: ui.t(p.kind === 'document' ? 'media.badTypeDoc' : 'media.badTypeImg') }); return; }
    if (p.size !== undefined && p.size > max) { setMsg({ tone: 'error', text: ui.t('media.tooBig', { mb: max / 1048576 }) }); return; }
    setBusy(p.kind);
    try {
      const meta = await getUpload.mutateAsync({ companyId: company.id, data: { filename: p.name.slice(0, 255), contentType: p.type, kind: p.kind } });
      const body = Platform.OS === 'web'
        ? await (await fetch(p.uri)).blob()
        : new File(p.uri);
      if (body.size > max) throw new RangeError('size');
      const put = await uploadFetch(meta.uploadUrl, { method: 'PUT', headers: { 'Content-Type': p.type }, body });
      if (!put.ok) throw new Error('put');
      await confirm.mutateAsync({ companyId: company.id, data: { objectPath: meta.objectPath, kind: p.kind } });
      await q.refetch();
      s.refetch();
      void qc.invalidateQueries({ queryKey: getGetPartnerCompanyQueryKey(company.id) });
      success();
      setMsg({ tone: 'info', text: ui.t('media.done') });
    } catch (e) {
      warn();
      setRetry(p);
      const tooBig = e instanceof RangeError;
      setMsg({ tone: 'error', text: tooBig ? ui.t('media.tooBig', { mb: max / 1048576 }) : (e as { status?: number }).status !== undefined ? ui.t(errKey(e)) : ui.t('media.uploadFail') });
    } finally {
      setBusy(null);
    }
  };

  const pickImage = async (kind: 'logo' | 'photo') => {
    setMsg(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setMsg({ tone: 'error', text: ui.t('media.permDenied'), settings: !perm.canAskAgain }); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: kind === 'logo', aspect: kind === 'logo' ? [1, 1] : undefined });
    const a = r.assets?.[0];
    if (r.canceled || !a) return;
    await upload({ uri: a.uri, name: a.fileName ?? `${kind}.jpg`, type: a.mimeType ?? 'image/jpeg', size: a.fileSize, kind });
  };
  const pickDoc = async () => {
    setMsg(null);
    const r = await DocumentPicker.getDocumentAsync({ type: DOC_TYPES, copyToCacheDirectory: true });
    const a = r.assets?.[0];
    if (r.canceled || !a) return;
    await upload({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', size: a.size, kind: 'document' });
  };

  return (
    <Screen onBack title={ui.t('company.media')} subtitle={company.name}>
      {!allowed ? <Banner tone="warn" text={ui.t('err.forbidden')} /> : null}
      {msg ? <Banner tone={msg.tone} icon={msg.tone === 'info' ? 'check-circle' : undefined} text={msg.text} actionLabel={msg.settings ? ui.t('push.openSettings') : retry ? ui.t('common.retry') : undefined}
        onAction={msg.settings ? () => void Linking.openSettings().catch(() => {}) : retry ? () => void upload(retry) : undefined} /> : null}

      <SectionTitle>{ui.t('media.logo')}</SectionTitle>
      <Card>
        {company.logo ? <AssetImage companyId={company.id} value={company.logo} size={96} /> : <T v="small" color={c.mutedForeground}>{ui.t('media.noLogo')}</T>}
        {allowed && <Button variant="ghost" icon="upload" label={ui.t('media.pickLogo')} onPress={() => void pickImage('logo')} loading={busy === 'logo'} disabled={!!busy} />}
        <T v="cap" color={c.mutedForeground}>{ui.t('media.imgLimits')}</T>
      </Card>

      <SectionTitle>{ui.t('media.photos')}</SectionTitle>
      <Card>
        {company.photos.length ? <View style={wrapRow(ui.row)}>{company.photos.map((p) => <AssetImage key={p} companyId={company.id} value={p} size={96} />)}</View> : <T v="small" color={c.mutedForeground}>{ui.t('media.noPhotos')}</T>}
        {allowed && <Button variant="ghost" icon="image" label={ui.t('media.addPhoto')} onPress={() => void pickImage('photo')} loading={busy === 'photo'} disabled={!!busy} />}
      </Card>

      <SectionTitle>{ui.t('media.docs')}</SectionTitle>
      <Card>
        <T v="small" color={c.mutedForeground}>{ui.t('media.docsPrivate')}</T>
        {company.documents.map((d, i) => <DocRow key={d} companyId={company.id} value={d} index={i} />)}
        {company.documents.length === 0 && <T v="small" color={c.mutedForeground}>{ui.t('media.noDocs')}</T>}
        {allowed && <Button variant="ghost" icon="file-plus" label={ui.t('media.addDoc')} onPress={() => void pickDoc()} loading={busy === 'document'} disabled={!!busy} />}
        <T v="cap" color={c.mutedForeground}>{ui.t('media.docLimits')}</T>
      </Card>
    </Screen>
  );
}
