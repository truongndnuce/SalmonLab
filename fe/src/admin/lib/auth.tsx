'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api';
import type { AdminUser } from './types';

type State = { status: 'loading' } | { status: 'anon' } | { status: 'authed'; user: AdminUser };

interface AuthContextValue {
  state: State;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    api.refreshSession().then((user) => {
      if (alive) setState(user ? { status: 'authed', user } : { status: 'anon' });
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    api.setSessionLostHandler(() => setState({ status: 'anon' }));
    return () => api.setSessionLostHandler(null);
  }, []);

  // Route guard (client-side: the refresh cookie is scoped to the API path, so Next middleware can't see it).
  useEffect(() => {
    if (state.status === 'anon' && pathname !== '/admin/login') {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state.status, pathname, router]);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await api.login(email, password);
    setState({ status: 'authed', user });
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setState({ status: 'anon' });
    router.replace('/admin/login');
  }, [router]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
