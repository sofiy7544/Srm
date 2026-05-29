'use client';

import { create } from 'zustand';
import type { UserBrief } from './api';

interface AuthState {
  user: UserBrief | null;
  setUser: (user: UserBrief | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
