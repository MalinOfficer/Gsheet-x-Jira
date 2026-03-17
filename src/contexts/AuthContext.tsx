'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface User {
  id:       string;
  username: string;
  email?:   string; // ✅ optional — kolom tidak ada di tabel users_account
  role?:    string; // ✅ optional — kolom tidak ada di tabel users_account
}

interface AuthContextType {
  user:      User | null;
  isLoading: boolean;
  login:     (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout:    () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache
// ─────────────────────────────────────────────────────────────────────────────
const _authCache: {
  user:    User | null;
  checked: boolean;
} = {
  user:    null,
  checked: false,
};

const AuthContext = createContext<AuthContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<User | null>(_authCache.user);
  const [isLoading, setIsLoading] = useState<boolean>(!_authCache.checked);

  useEffect(() => {
    if (_authCache.checked) {
      setUser(_authCache.user);
      setIsLoading(false);
      return;
    }

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            _authCache.user    = data.user;
            _authCache.checked = true;
            setUser(data.user);
          } else {
            _authCache.user    = null;
            _authCache.checked = true;
            setUser(null);
          }
        } else {
          _authCache.user    = null;
          _authCache.checked = true;
          setUser(null);
        }
      } catch {
        _authCache.user    = null;
        _authCache.checked = true;
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = useCallback(async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Login gagal' };
      }

      if (data.success && data.user) {
        _authCache.user    = data.user;
        _authCache.checked = true;
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data.error || 'Login gagal' };
    } catch {
      return { success: false, error: 'Gagal terhubung ke server' };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    _authCache.user    = null;
    _authCache.checked = false;

    window.dispatchEvent(new CustomEvent('user-logout'));

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}

    setUser(null);
    window.location.replace('/login');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai dalam AuthProvider');
  return ctx;
}