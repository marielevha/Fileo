import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { LoginResponse } from '../types/auth';

const SESSION_KEY = 'fileo.auth.session';

export type StoredAuthSession = {
  token: string;
  refreshToken: string;
  expiresAt: string;
  persist: boolean;
  userId?: string;
  workshopId?: string;
  currency?: string;
  measurementUnits?: string[];
};

let memorySession: StoredAuthSession | null = null;

export async function saveAuthSession(
  session: Pick<LoginResponse, 'token' | 'refreshToken' | 'expiresAt'> & Partial<Pick<LoginResponse, 'user' | 'workshop'>>,
  persist: boolean,
) {
  const previous = memorySession;
  memorySession = {
    token: session.token,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    persist,
    userId: session.user?.id ?? previous?.userId,
    workshopId: session.workshop?.id ?? previous?.workshopId,
    currency: session.workshop?.currency ?? previous?.currency,
    measurementUnits: session.workshop?.measurementUnits ?? previous?.measurementUnits,
  };
  const serialised = JSON.stringify(memorySession);

  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      if (persist) localStorage.setItem(SESSION_KEY, serialised);
      else localStorage.removeItem(SESSION_KEY);
    }
    return;
  }

  if (persist) await SecureStore.setItemAsync(SESSION_KEY, serialised);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getAuthSession(): Promise<StoredAuthSession | null> {
  if (memorySession) return memorySession;

  const serialised = Platform.OS === 'web'
    ? typeof localStorage === 'undefined' ? null : localStorage.getItem(SESSION_KEY)
    : await SecureStore.getItemAsync(SESSION_KEY);

  if (!serialised) return null;
  try {
    const parsed = JSON.parse(serialised) as Partial<StoredAuthSession>;
    if (!parsed.token || !parsed.refreshToken || !parsed.expiresAt) {
      await clearAuthSession();
      return null;
    }
    memorySession = {
      token: parsed.token,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      persist: true,
      userId: parsed.userId,
      workshopId: parsed.workshopId,
      currency: parsed.currency,
      measurementUnits: parsed.measurementUnits,
    };
    return memorySession;
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function getAuthToken(): Promise<string | null> {
  return (await getAuthSession())?.token ?? null;
}

export async function clearAuthSession() {
  memorySession = null;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export const clearAuthToken = clearAuthSession;
