import { create } from 'zustand';
import { api } from '@/utils/api';
import type { User } from '../../shared/types';

interface AuthState {
  user: User | null;
  token: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  permissions: [],
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const result = await api.post<{ token: string; user: User; permissions: string[] }>('/auth/login', {
        username,
        password,
      });
      localStorage.setItem('auth_token', result.token);
      set({
        token: result.token,
        user: result.user,
        permissions: result.permissions,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({
      user: null,
      token: null,
      permissions: [],
      isAuthenticated: false,
    });
  },

  fetchCurrentUser: async () => {
    try {
      const result = await api.get<{ user: User; permissions: string[] }>('/auth/me');
      set({
        user: result.user,
        permissions: result.permissions,
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem('auth_token');
      set({
        user: null,
        token: null,
        permissions: [],
        isAuthenticated: false,
      });
    }
  },
}));
