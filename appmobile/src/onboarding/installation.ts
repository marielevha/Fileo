import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

const INSTALLATION_KEY = 'fileo.onboarding.installation';

export async function hasSeenOnboarding(): Promise<boolean> {
  const localId = await Storage.getItem(INSTALLATION_KEY);
  if (!localId) return false;
  if (Platform.OS === 'web') return true;
  return localId === await SecureStore.getItemAsync(INSTALLATION_KEY);
}

export async function markOnboardingSeen(): Promise<void> {
  if (await hasSeenOnboarding()) return;
  const id = randomUUID();
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(INSTALLATION_KEY, id);
  await Storage.setItem(INSTALLATION_KEY, id);
}
