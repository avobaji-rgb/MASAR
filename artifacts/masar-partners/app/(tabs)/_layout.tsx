import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useUI } from '@/lib/i18n';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

// iOS 26 NativeTabs get system liquid glass; brand colors apply on the classic path.
function NativeTabLayout() {
  const { t } = useUI();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{t('tab.home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="jobs">
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} />
        <NativeTabs.Trigger.Label>{t('tab.jobs')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="company">
        <NativeTabs.Trigger.Icon sf={{ default: 'building.2', selected: 'building.2.fill' }} />
        <NativeTabs.Trigger.Label>{t('tab.company')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>{t('tab.settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { t, font } = useUI();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const icon = (sf: string, feather: React.ComponentProps<typeof Feather>['name']) =>
    ({ color }: { color: import('react-native').ColorValue }) =>
      isIOS ? <SymbolView name={sf as never} tintColor={color as string} size={24} /> : <Feather name={feather} size={22} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: font('medium'), fontSize: 11 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} /> : isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} /> : null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarIcon: icon('house', 'home') }} />
      <Tabs.Screen name="jobs" options={{ title: t('tab.jobs'), tabBarIcon: icon('tray', 'inbox') }} />
      <Tabs.Screen name="company" options={{ title: t('tab.company'), tabBarIcon: icon('building.2', 'briefcase') }} />
      <Tabs.Screen name="settings" options={{ title: t('tab.settings'), tabBarIcon: icon('gearshape', 'settings') }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
