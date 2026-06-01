import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { UserDto } from '@/types/api';

const ACCESS_TOKEN_KEY = 'optime.accessToken';

interface AuthState {
  accessToken: string | null;
  user: UserDto | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (accessToken: string, user: UserDto) => Promise<void>;
  setUser: (user: UserDto | null) => void;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  hydrate: async () => {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    set({ accessToken, hydrated: true });
  },
  setSession: async (accessToken, user) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    set({ accessToken, user });
  },
  setUser: (user) => set({ user }),
  clearSession: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    set({ accessToken: null, user: null });
  }
}));
