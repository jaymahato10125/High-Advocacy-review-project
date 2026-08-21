import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '@proofdesk/shared';
import { api } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (role: 'reviewer' | 'viewer') => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (role: 'reviewer' | 'viewer') => {
    const u = await api<AuthUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ role }) });
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function homeFor(user: AuthUser | null): string {
  if (!user) return '/login';
  return user.role === 'reviewer' ? '/queue' : '/approved';
}
