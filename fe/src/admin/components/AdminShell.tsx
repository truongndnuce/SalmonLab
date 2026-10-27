'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { Button } from './ui';

const NAV = [
  { href: '/admin', label: 'Tổng quan', exact: true },
  { href: '/admin/posts', label: 'Bài viết' },
  { href: '/admin/notes', label: 'Ghi chú' },
  { href: '/admin/series', label: 'Loạt bài' },
  { href: '/admin/media', label: 'Thư viện ảnh' },
  { href: '/admin/taxonomy', label: 'Danh mục & thẻ' },
  { href: '/admin/pages', label: 'Trang tĩnh' },
  { href: '/admin/settings', label: 'Cài đặt' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state, signOut } = useAuth();
  const pathname = usePathname();

  if (state.status !== 'authed') {
    return (
      <div className="grid min-h-screen place-items-center text-muted" aria-busy="true">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-border bg-surface-note md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Link href="/admin" className="text-lg font-bold">
            Salmon Lab <span className="text-xs font-normal uppercase tracking-wider text-muted">admin</span>
          </Link>
        </div>
        <nav aria-label="Quản trị" className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:pb-0">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? 'bg-bg font-semibold text-accent shadow-sm' : 'text-fg hover:bg-bg'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 pt-8 text-sm md:block">
          <a href="/" target="_blank" rel="noopener" className="text-muted hover:text-accent">
            Xem trang web ↗
          </a>
          <p className="mt-4 truncate text-xs text-muted">{state.user.email}</p>
          <Button variant="ghost" className="-ml-3 mt-1" onClick={() => void signOut()}>
            Đăng xuất
          </Button>
        </div>
      </aside>
      <div className="min-w-0 px-5 py-6 md:px-8">{children}</div>
    </div>
  );
}
