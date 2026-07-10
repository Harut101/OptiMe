import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function canUseWebStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export async function getPersistedItem(key: string) {
  if (Platform.OS === 'web') {
    return canUseWebStorage() ? window.localStorage.getItem(key) : null;
  }

  return SecureStore.getItemAsync(key);
}

export async function setPersistedItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    if (canUseWebStorage()) {
      window.localStorage.setItem(key, value);
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function deletePersistedItem(key: string) {
  if (Platform.OS === 'web') {
    if (canUseWebStorage()) {
      window.localStorage.removeItem(key);
    }
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
