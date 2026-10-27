import type { Metadata } from 'next';
import { AuthProvider } from '@/admin/lib/auth';
import { ToastProvider } from '@/admin/lib/toast';

export const metadata: Metadata = {
  title: { default: 'Quản trị · Salmon Lab', template: '%s · Quản trị' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
