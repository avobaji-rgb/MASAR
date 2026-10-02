import React, { useEffect } from 'react';
import {
  ActivityIndicator, Image, Platform, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextProps, type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export type IconName = React.ComponentProps<typeof Feather>['name'];
export const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
export const success = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
export const warn = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); };

const SIZES = {
  display: { size: 30, w: 'bold' },
  title: { size: 24, w: 'bold' },
  h2: { size: 18, w: 'bold' },
  body: { size: 16, w: 'regular' },
  small: { size: 14, w: 'regular' },
  label: { size: 13, w: 'bold' },
  cap: { size: 12, w: 'medium' },
} as const;

export function T({ v = 'body', w, color, style, children, ...rest }: TextProps & { v?: keyof typeof SIZES; w?: 'regular' | 'medium' | 'bold'; color?: string }) {
  const { rtl, font } = useUI();
  const c = useColors();
  const s = SIZES[v];
  return (
    <Text
      {...rest}
      style={[{ fontFamily: font(w ?? s.w), fontSize: s.size, lineHeight: s.size * (rtl ? 1.6 : 1.4), color: color ?? c.foreground, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }, style]}
    >
      {children}
    </Text>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return <Image source={require('@/assets/images/masar-pin.png')} style={{ width: size * 0.8, height: size }} resizeMode="contain" accessibilityLabel="MASAR" />;
}

export function Screen({
  title, subtitle, onBack, right, tabs, onRefresh, refreshing, children, footer, brand,
}: {
  title?: string; subtitle?: string; onBack?: boolean; right?: React.ReactNode; tabs?: boolean;
  onRefresh?: () => void; refreshing?: boolean; children: React.ReactNode; footer?: React.ReactNode; brand?: boolean;
}) {
  const c = useColors();
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        contentContainerStyle={{ paddingTop: insets.top + (web ? 67 : 12), paddingBottom: insets.bottom + (web ? 34 : 0) + (tabs ? 110 : 32), paddingHorizontal: 20, gap: 14 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}
      >
        {(title || onBack || brand) && (
          <View style={[ui.row, { alignItems: 'center', gap: 12, marginBottom: 6 }]}>
            {onBack && (
              <Pressable accessibilityRole="button" accessibilityLabel={ui.t('common.back')} onPress={() => { tap(); router.back(); }} hitSlop={8}
                style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
                <Feather name={ui.back} size={22} color={c.primary} />
              </Pressable>
            )}
            {brand && <Logo size={46} />}
            <View style={{ flex: 1 }}>
              {title ? <T v="title" numberOfLines={2}>{title}</T> : null}
              {subtitle ? <T v="small" color={c.mutedForeground}>{subtitle}</T> : null}
            </View>
            {right}
          </View>
        )}
        {children}
      </KeyboardAwareScrollViewCompat>
      {footer}
    </View>
  );
}

export function Card({ children, style, tone = 'plain', onPress, entering = true }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'plain' | 'navy' | 'gold' | 'danger' | 'accent'; onPress?: () => void; entering?: boolean;
}) {
  const c = useColors();
  const bg = { plain: c.card, navy: c.navyDeep, gold: c.goldSoft, danger: c.dangerSoft, accent: c.accent }[tone];
  const border = { plain: c.border, navy: c.navyDeep, gold: '#F1D98B', danger: '#EDBDB8', accent: '#C9E1EC' }[tone];
  const inner = (
    <Animated.View entering={entering ? FadeInDown.duration(240) : undefined}
      style={[{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: c.radius + 4, padding: 16, gap: 10 }, style]}>
      {children}
    </Animated.View>
  );
  if (!onPress) return inner;
  return (
    <Pressable accessibilityRole="button" onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      {inner}
    </Pressable>
  );
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, style, testID }: {
  label: string; onPress: () => void; variant?: 'primary' | 'gold' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const c = useColors();
  const ui = useUI();
  const palette = {
    primary: { bg: c.primary, fg: c.primaryForeground, bd: c.primary },
    gold: { bg: c.gold, fg: c.secondaryForeground, bd: c.gold },
    ghost: { bg: c.card, fg: c.primary, bd: c.input },
    danger: { bg: c.destructive, fg: c.destructiveForeground, bd: c.destructive },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} disabled={off}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [{ minHeight: 56, borderRadius: 16, borderWidth: 1, backgroundColor: palette.bg, borderColor: palette.bd, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.55 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}>
      <View style={[ui.row, { alignItems: 'center', gap: 10 }]}>
        {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Feather name={icon} size={20} color={palette.fg} /> : null}
        <T v="body" w="bold" color={palette.fg} style={{ textAlign: 'center' }}>{label}</T>
      </View>
    </Pressable>
  );
}

export function Field({ label, error, hint, ltr, style, ...rest }: TextInputProps & { label: string; error?: string | null; hint?: string; ltr?: boolean }) {
  const c = useColors();
  const { rtl, font } = useUI();
  const right = rtl && !ltr;
  return (
    <View style={{ gap: 6 }}>
      <T v="label" color={c.mutedForeground}>{label}</T>
      <TextInput
        placeholderTextColor={c.mutedForeground}
        accessibilityLabel={label}
        {...rest}
        style={[{ minHeight: rest.multiline ? 104 : 54, borderRadius: 14, borderWidth: 1.5, borderColor: error ? c.destructive : c.input, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.foreground, fontFamily: font('regular'), textAlign: right ? 'right' : 'left', writingDirection: right ? 'rtl' : 'ltr', textAlignVertical: rest.multiline ? 'top' : 'center' }, style]}
      />
      {hint && !error ? <T v="cap" color={c.mutedForeground}>{hint}</T> : null}
      {error ? <T v="cap" color={c.destructive}>{error}</T> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const c = useColors();
  const ui = useUI();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={() => { tap(); onPress?.(); }} disabled={!onPress}
      style={[ui.row, { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: selected ? c.primary : c.input, backgroundColor: selected ? c.accent : c.card }]}>
      {icon && <Feather name={icon} size={16} color={selected ? c.primary : c.mutedForeground} />}
      <T v="small" w="bold" color={selected ? c.accentForeground : c.foreground}>{label}</T>
    </Pressable>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string; badge?: number }[]; value: K; onChange: (k: K) => void }) {
  const c = useColors();
  const ui = useUI();
  return (
    <View style={[ui.row, { backgroundColor: c.muted, borderRadius: 16, padding: 4, gap: 4 }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(o.key); }}
            style={[ui.row, { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? c.card : 'transparent' }]}>
            <T v="small" w="bold" color={on ? c.primary : c.mutedForeground}>{o.label}</T>
            {o.badge ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center' }}>
                <T v="cap" w="bold" color={c.secondaryForeground} style={{ textAlign: 'center' }}>{String(o.badge)}</T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ label, tone = 'navy' }: { label: string; tone?: 'navy' | 'gold' | 'green' | 'red' | 'muted' }) {
  const c = useColors();
  const m = {
    navy: [c.accent, c.accentForeground], gold: [c.goldSoft, c.goldInk], green: [c.successSoft, c.success], red: [c.dangerSoft, c.destructive], muted: [c.muted, c.mutedForeground],
  }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: m[0] }}>
      <T v="cap" w="bold" color={m[1]}>{label}</T>
    </View>
  );
}

export function Banner({ tone = 'warn', text, actionLabel, onAction, icon }: { tone?: 'warn' | 'error' | 'info'; text: string; actionLabel?: string; onAction?: () => void; icon?: IconName }) {
  const c = useColors();
  const ui = useUI();
  const m = { warn: [c.goldSoft, c.goldInk, 'alert-triangle'], error: [c.dangerSoft, c.destructive, 'wifi-off'], info: [c.accent, c.accentForeground, 'info'] }[tone] as [string, string, IconName];
  return (
    <View accessibilityRole="alert" style={[ui.row, { backgroundColor: m[0], borderRadius: 16, padding: 14, gap: 12, alignItems: 'center' }]}>
      <Feather name={icon ?? m[2]} size={20} color={m[1]} />
      <View style={{ flex: 1, gap: 6 }}>
        <T v="small" color={m[1]}>{text}</T>
        {actionLabel && onAction ? (
          <Pressable onPress={() => { tap(); onAction(); }} hitSlop={10} style={{ minHeight: 36, justifyContent: 'center' }}>
            <T v="small" w="bold" color={m[1]} style={{ textDecorationLine: 'underline' }}>{actionLabel}</T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12, gap: 12 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.gold }}>
        <Feather name={icon} size={30} color={c.primary} />
      </View>
      <T v="h2" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T v="small" color={c.mutedForeground} style={{ textAlign: 'center', maxWidth: 320 }}>{body}</T> : null}
      {action ? <View style={{ alignSelf: 'stretch', marginTop: 6 }}>{action}</View> : null}
    </View>
  );
}

export function Skeleton({ height = 90 }: { height?: number }) {
  const c = useColors();
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, borderRadius: 20, backgroundColor: c.muted }, st]} />;
}
export function Skeletons({ n = 3, height }: { n?: number; height?: number }) {
  return <>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} height={height} />)}</>;
}

export function ErrorState({ kindText, onRetry }: { kindText: string; onRetry: () => void }) {
  const ui = useUI();
  return <EmptyState icon="cloud-off" title={ui.t('err.title')} body={kindText} action={<Button variant="ghost" icon="refresh-cw" label={ui.t('common.retry')} onPress={onRetry} />} />;
}

export function SwitchRow({ title, body, value, onValueChange, disabled, busy }: { title: string; body?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; busy?: boolean }) {
  const c = useColors();
  const ui = useUI();
  return (
    <View style={[ui.row, { alignItems: 'center', gap: 12, minHeight: 56 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body" w="bold">{title}</T>
        {body ? <T v="small" color={c.mutedForeground}>{body}</T> : null}
      </View>
      {busy ? <ActivityIndicator color={c.primary} /> : (
        <Switch value={value} disabled={disabled} onValueChange={(v) => { tap(); onValueChange(v); }} trackColor={{ true: c.primary, false: c.input }} thumbColor={value ? c.gold : '#FFFDF9'} accessibilityLabel={title} />
      )}
    </View>
  );
}

export function KV({ k, v, ltr }: { k: string; v?: string | null; ltr?: boolean }) {
  const c = useColors();
  const ui = useUI();
  return (
    <View style={[ui.row, { gap: 12, paddingVertical: 6, alignItems: 'flex-start' }]}>
      <T v="small" color={c.mutedForeground} style={{ width: 104 }}>{k}</T>
      <T v="small" w="medium" style={[{ flex: 1 }, ltr ? { textAlign: ui.rtl ? 'right' : 'left', writingDirection: 'ltr' } : null]} selectable>{v || '-'}</T>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const ui = useUI();
  const c = useColors();
  return (
    <View style={[ui.row, { alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }]}>
      <T v="label" color={c.mutedForeground} style={{ letterSpacing: ui.rtl ? 0 : 1, textTransform: ui.rtl ? 'none' : 'uppercase' }}>{children}</T>
      {right}
    </View>
  );
}

export const wrapRow = (row: { flexDirection: 'row' | 'row-reverse' }) => [row, { flexWrap: 'wrap', gap: 8 }] as StyleProp<ViewStyle>;
export const hairline = StyleSheet.hairlineWidth;
