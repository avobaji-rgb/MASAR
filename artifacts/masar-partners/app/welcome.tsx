import React from 'react';
import { Image, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { CLERK_KEY } from '@/lib/config';
import { Banner, Button, Chip, T, wrapRow } from '@/components/ui';

export default function Welcome() {
  const ui = useUI();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  return (
    <LinearGradient colors={[c.navyDeep, c.primary, '#1B6AC2']} style={{ flex: 1, paddingTop: insets.top + (web ? 67 : 24), paddingBottom: insets.bottom + (web ? 34 : 20), paddingHorizontal: 24 }}>
      <View style={[ui.row, { justifyContent: 'flex-end', gap: 8 }]}>
        <View style={wrapRow(ui.row)}>
          <Chip label="العربية" selected={ui.locale === 'ar'} onPress={() => ui.setLocale('ar')} />
          <Chip label="English" selected={ui.locale === 'en'} onPress={() => ui.setLocale('en')} />
        </View>
      </View>
      <Animated.View entering={FadeInDown.duration(500)} style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
        <View style={{ alignSelf: 'center', alignItems: 'center', backgroundColor: '#FFFBEF', borderRadius: 28, padding: 18 }}>
          <Image source={require('@/assets/images/masar-logo.png')} style={{ width: 210, height: 70 }} resizeMode="contain" accessibilityLabel="MASAR" />
        </View>
        <View style={{ alignSelf: ui.start, backgroundColor: c.gold, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5 }}>
          <T v="label" color={c.secondaryForeground}>{ui.t('app.partners')}</T>
        </View>
        <T v="display" color="#FFFBEF" style={{ fontSize: 34, lineHeight: ui.rtl ? 54 : 42 }}>{ui.t('welcome.headline')}</T>
        <T v="body" color="#D5E3F5">{ui.t('welcome.body')}</T>
      </Animated.View>
      <View style={{ gap: 12 }}>
        {!CLERK_KEY && <Banner tone="warn" icon="lock" text={ui.t('auth.notActive')} />}
        <Button variant="gold" label={ui.t('auth.signIn')} icon="log-in" onPress={() => router.push('/sign-in')} />
        <Button variant="ghost" label={ui.t('auth.signUp')} icon="user-plus" onPress={() => router.push('/sign-up')} />
      </View>
    </LinearGradient>
  );
}
