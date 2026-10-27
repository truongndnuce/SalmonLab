'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, ErrorNote, PageHeader, shortDate, StatusBadge } from '@/admin/components/ui';
import { errorMessage, post } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import type { AdminNote, AdminPost, AdminSeries } from '@/admin/lib/types';
import { useAdminData } from '@/admin/lib/use-admin-data';

function Stat({ label, value, href }: { label: string; value: number | undefined; href: string }) {
  return (
    <Link href={href} className="rounded-card border border-border bg-surface p-4 hover:border-accent">
      <p className="text-3xl font-bold tabular-nums">{value ?? '…'}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const { notify } = useToast();
  const published = useAdminData<AdminPost[]>('/admin/posts?status=PUBLISHED&pageSize=1');
  const drafts = useAdminData<AdminPost[]>('/admin/posts?status=DRAFT&pageSize=5');
  const notes = useAdminData<AdminNote[]>('/admin/notes?pageSize=1');
  const series = useAdminData<AdminSeries[]>('/admin/series');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revalidate() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await post<{ ok: boolean }>('/admin/revalidate', {});
      if (data.ok) notify('Đã yêu cầu làm mới cache trang web');
      else setError('Không gọi được trang web để làm mới cache (xem log API).');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tổng quan"
        actions={
          <>
            <Link href="/admin/posts/new" className="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-hover">
              + Bài mới
            </Link>
            <Link href="/admin/notes" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent">
              Ghi chú nhanh
            </Link>
          </>
        }
      />
      <ErrorNote message={error ?? published.error} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Bài đã đăng" value={published.meta?.total} href="/admin/posts" />
        <Stat label="Bản nháp" value={drafts.meta?.total} href="/admin/posts" />
        <Stat label="Ghi chú" value={notes.meta?.total} href="/admin/notes" />
        <Stat label="Loạt bài" value={series.data?.length} href="/admin/series" />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Bản nháp gần đây</h2>
        {drafts.data?.length === 0 && <p className="text-muted">Không có bản nháp nào.</p>}
        <ul className={`divide-y divide-border rounded-card border border-border ${drafts.data?.length ? '' : 'hidden'}`}>
          {drafts.data?.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <Link href={`/admin/posts/${p.id}`} className="min-w-0 truncate font-medium text-accent hover:underline">
                {p.title}
              </Link>
              <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
                <StatusBadge status={p.status} publishedAt={p.publishedAt} />
                {shortDate(p.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-card border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">Làm mới cache</h2>
        <p className="mt-1 text-sm text-muted">
          Trang công khai tự làm mới khi bạn đăng/sửa nội dung. Dùng nút này nếu thấy trang web chưa cập nhật (ví dụ sau khi deploy hoặc với bài hẹn giờ).
        </p>
        <Button className="mt-3" disabled={busy} onClick={() => void revalidate()}>
          {busy ? 'Đang gửi…' : 'Làm mới toàn bộ'}
        </Button>
      </section>
    </>
  );
}
