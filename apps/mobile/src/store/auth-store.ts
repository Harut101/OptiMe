import { create } from 'zustand';

import { deletePersistedItem, getPersistedItem, setPersistedItem } from './persistent-storage';
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
    const accessToken = await getPersistedItem(ACCESS_TOKEN_KEY);
    set({ accessToken, hydrated: true });
  },
  setSession: async (accessToken, user) => {
    await setPersistedItem(ACCESS_TOKEN_KEY, accessToken);
    set({ accessToken, user });
  },
  setUser: (user) => set({ user }),
  clearSession: async () => {
    await deletePersistedItem(ACCESS_TOKEN_KEY);
    set({ accessToken: null, user: null });
  }
}));
