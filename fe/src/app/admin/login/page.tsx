'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button, ErrorNote, Field, inputCls } from '@/admin/components/ui';
import { errorMessage } from '@/admin/lib/api';
import { useAuth } from '@/admin/lib/auth';

function LoginForm() {
  const { state, signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only follow same-site admin paths to avoid an open redirect through ?next=.
  const next = params.get('next');
  const target = next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin';

  useEffect(() => {
    if (state.status === 'authed') router.replace(target);
  }, [state.status, router, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-card border border-border bg-surface p-7">
      <h1 className="mb-1 text-2xl font-bold">Đăng nhập</h1>
      <p className="mb-6 text-sm text-muted">Khu vực quản trị Salmon Lab</p>
      <ErrorNote message={error} />
      <div className="space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mật khẩu">
          <input
            className={inputCls}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
