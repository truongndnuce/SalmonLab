'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, ConfirmButton, ErrorNote, inputCls, PageHeader, shortDate, StatusBadge } from '@/admin/components/ui';
import { del, errorMessage, post } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import type { AdminPost } from '@/admin/lib/types';
import { useAdminData } from '@/admin/lib/use-admin-data';

const PAGE_SIZE = 20;
const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'PUBLISHED', label: 'Đã đăng' },
] as const;

export default function PostsAdminPage() {
  const { notify } = useToast();
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) qs.set('status', status);
  if (kind) qs.set('kind', kind);
  if (debouncedQ) qs.set('q', debouncedQ);
  const { data, meta, error, loading, reload } = useAdminData<AdminPost[]>(`/admin/posts?${qs}`);

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    setActionError(null);
    try {
      await fn();
      notify(okText);
      reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const filter = (fn: () => void) => () => {
    fn();
    setPage(1);
  };
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Bài viết"
        actions={
          <>
            <Link href="/admin/posts/import" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent">
              Nhập từ file
            </Link>
            <Link href="/admin/posts/new" className="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-hover">
              + Bài mới
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Lọc theo trạng thái" className="inline-flex gap-1 rounded-lg border border-border bg-surface-note p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={status === t.key}
              onClick={filter(() => setStatus(t.key))}
              className={`rounded-md px-3 py-1 text-sm ${status === t.key ? 'bg-bg font-semibold text-accent shadow-sm' : 'text-muted hover:text-fg'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select aria-label="Loại" className={`${inputCls} !w-auto`} value={kind} onChange={(e) => filter(() => setKind(e.target.value))()}>
          <option value="">Mọi loại</option>
          <option value="POST">Bài viết</option>
          <option value="INFOGRAPHIC">Infographic</option>
        </select>
        <input aria-label="Tìm theo tiêu đề" className={`${inputCls} !w-60`} placeholder="Tìm theo tiêu đề…" value={q} onChange={(e) => filter(() => setQ(e.target.value))()} />
      </div>

      <ErrorNote message={error ?? actionError} />

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-note text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Tiêu đề</th>
              <th className="px-4 py-2 font-medium">Trạng thái</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Danh mục</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Cập nhật</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.map((p) => (
              <tr key={p.id} className="align-middle">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/posts/${p.id}`} className="font-medium text-accent hover:underline">
                    {p.title}
                  </Link>
                  {p.kind === 'INFOGRAPHIC' && <span className="ml-2 text-xs text-muted">infographic</span>}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={p.status} publishedAt={p.publishedAt} />
                </td>
                <td className="hidden px-4 py-2.5 text-muted md:table-cell">{p.category?.name ?? '—'}</td>
                <td className="hidden px-4 py-2.5 text-muted md:table-cell">{shortDate(p.updatedAt)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {p.status === 'PUBLISHED' ? (
                      <Button onClick={() => void act(() => post(`/admin/posts/${p.id}/unpublish`), 'Đã gỡ xuất bản')}>Gỡ</Button>
                    ) : (
                      <Button onClick={() => void act(() => post(`/admin/posts/${p.id}/publish`), 'Đã xuất bản')}>Đăng</Button>
                    )}
                    <ConfirmButton onConfirm={() => act(() => del(`/admin/posts/${p.id}`), 'Đã xoá bài viết')} />
                  </div>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  Không có bài viết nào.
                </td>
              </tr>
            )}
            {!data && loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{meta.total} bài</span>
          <div className="flex items-center gap-2">
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Trước
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Sau →
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
