import type { PartnerJob } from '@workspace/api-client-react';
import type { StringKey } from './strings';

export const SERVICE_PRESETS = ['towing', 'roadside', 'tires', 'battery', 'repair', 'ev'] as const;
export type StepGroup = 'tow' | 'onsite' | 'other';
export const OFFER_STATUSES = ['offered'];
export const ACTIVE_STATUSES = ['accepted', 'enroute', 'arrived'];
export const HISTORY_STATUSES = ['completed', 'unavailable', 'declined', 'expired'];

export function stepGroup(service: string): StepGroup {
  if (service === 'tow') return 'tow';
  if (['flat', 'battery', 'fuel', 'lockout', 'ev'].includes(service)) return 'onsite';
  return 'other';
}
export function nextStatus(s: string, service: string): 'enroute' | 'arrived' | 'completed' | null {
  if (s === 'accepted' && ['other', 'repair', 'garage'].includes(service)) return 'arrived';
  if (s === 'accepted') return 'enroute';
  if (s === 'enroute') return 'arrived';
  if (s === 'arrived') return 'completed';
  return null;
}
export function stepKey(service: string, status: string): StringKey {
  return `step.${stepGroup(service)}.${status}` as StringKey;
}
export function serviceLabelKey(service: string): StringKey | null {
  return ['flat', 'battery', 'fuel', 'tow', 'lockout', 'ev', 'other'].includes(service) ? (`svc.${service}` as StringKey) : null;
}
export function presetLabelKey(s: string): StringKey | null {
  return (SERVICE_PRESETS as readonly string[]).includes(s) ? (`preset.${s}` as StringKey) : null;
}
export function isOpenOffer(j: PartnerJob): boolean {
  return j.status === 'offered';
}
export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
}

export type ErrKind = 'network' | 'auth' | 'forbidden' | 'notfound' | 'conflict' | 'invalid' | 'server';
export function errKind(e: unknown): ErrKind {
  const status = (e as { status?: number } | null)?.status;
  if (status === undefined) return 'network';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notfound';
  if (status === 409 || status === 412) return 'conflict';
  if (status === 400 || status === 422) return 'invalid';
  return 'server';
}
export function errKey(e: unknown): StringKey {
  return `err.${errKind(e)}` as StringKey;
}
