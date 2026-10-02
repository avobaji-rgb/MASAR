import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_700Bold } from '@expo-google-fonts/noto-sans-arabic';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl } from '@workspace/api-client-react';
import { AuthRoot, useAuthState } from '@/lib/auth';
import { API_BASE } from '@/lib/config';
import { I18nProvider, loadLocale, type Locale } from '@/lib/i18n';
import { SessionProvider } from '@/lib/session';
import { PushProvider } from '@/lib/push';
import { Logo } from '@/components/ui';
import colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync();
setBaseUrl(API_BASE);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000, gcTime: 10 * 60 * 1000, retry: 1, refetchOnReconnect: true },
  },
});

function Routes() {
  const { isLoaded, isSignedIn } = useAuthState();
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.background }}>
        <Logo size={72} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="register" />
        <Stack.Screen name="edit-company" />
        <Stack.Screen name="media" />
        <Stack.Screen name="members" />
        <Stack.Screen name="operator" />
        <Stack.Screen name="job/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
    NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_700Bold,
  });
  const [locale, setLocale] = useState<Locale | null>(null);
  useEffect(() => { loadLocale().then(setLocale); }, []);
  // Web should not remain blank while the preview proxy fetches large font assets.
  // Native keeps its splash until bundled fonts are ready.
  const ready = (Platform.OS === 'web' || fontsLoaded || !!fontError) && locale !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready || !locale) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: colors.light.background }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.light.primary }}>MASAR Partners</Text>
      <ActivityIndicator size="large" color={colors.light.primary} />
    </View>
  );

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <I18nProvider initial={locale} fontsReady={fontsLoaded}>
                <AuthRoot>
                  <SessionProvider>
                    <PushProvider>
                      <StatusBar style="dark" />
                      <Routes />
                    </PushProvider>
                  </SessionProvider>
                </AuthRoot>
              </I18nProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
