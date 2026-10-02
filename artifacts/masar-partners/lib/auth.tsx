import React, { createContext, useContext, useMemo, useRef } from 'react';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { CLERK_KEY, CLERK_PROXY_URL } from './config';

export type AuthState = {
  configured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  signOut: () => Promise<void>;
};
const Ctx = createContext<AuthState>({
  configured: false,
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  signOut: async () => {},
});
export const useAuthState = () => useContext(Ctx);

function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const ref = useRef(getToken);
  ref.current = getToken;
  // Set during render so child queries never fire before the getter exists.
  setAuthTokenGetter(() => ref.current());
  const value = useMemo<AuthState>(
    () => ({
      configured: true,
      isLoaded,
      isSignedIn: !!isSignedIn,
      userId: userId ?? null,
      signOut: async () => {
        await signOut();
      },
    }),
    [isLoaded, isSignedIn, userId, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function AuthRoot({ children }: { children: React.ReactNode }) {
  if (!CLERK_KEY) {
    setAuthTokenGetter(null);
    return <>{children}</>;
  }
  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache} proxyUrl={CLERK_PROXY_URL}>
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}
