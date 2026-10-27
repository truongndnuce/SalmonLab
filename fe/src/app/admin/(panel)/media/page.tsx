'use client';

import { useRef, useState } from 'react';
import { Button, ConfirmButton, ErrorNote, inputCls, PageHeader } from '@/admin/components/ui';
import { del, errorMessage, patch, uploadImage } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import type { AdminMedia } from '@/admin/lib/types';
import { useAdminData } from '@/admin/lib/use-admin-data';

const PAGE_SIZE = 24;
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

function Card({ m, onChanged }: { m: AdminMedia; onChanged: () => void }) {
  const { notify } = useToast();
  const [alt, setAlt] = useState(m.alt ?? '');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setError(null);
    try {
      await fn();
      notify(okText);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const markdown = `![${m.alt ?? ''}](${m.url})`;

  return (
    <li className="overflow-hidden rounded-card border border-border bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails from the media bucket */}
      <img src={m.url} alt={m.alt ?? ''} loading="lazy" className="aspect-video w-full bg-surface-note object-cover" />
      <div className="space-y-2 p-3">
        <p className="text-xs text-muted">
          {m.width}×{m.height} · {kb(m.size)}
        </p>
        <ErrorNote message={error} />
        <input aria-label="Mô tả ảnh (alt)" className={inputCls} placeholder="Mô tả ảnh (alt)" value={alt} onChange={(e) => setAlt(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={alt.trim() === (m.alt ?? '')} onClick={() => void run(() => patch(`/admin/media/${m.id}`, { alt: alt.trim() || null }), 'Đã lưu mô tả')}>
            Lưu alt
          </Button>
          <Button onClick={() => void run(() => navigator.clipboard.writeText(markdown), 'Đã chép Markdown')}>Chép Markdown</Button>
          <ConfirmButton onConfirm={() => run(() => del(`/admin/media/${m.id}`), 'Đã xoá ảnh')} />
        </div>
        <p className="text-xs text-muted">Xoá ảnh sẽ làm hỏng các bài đang dùng ảnh này.</p>
      </div>
    </li>
  );
}

export default function MediaAdminPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const { data, meta, error, loading, reload } = useAdminData<AdminMedia[]>(`/admin/media?page=${page}&pageSize=${PAGE_SIZE}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  async function upload(files: FileList) {
    setBusy(true);
    setErr(null);
    try {
      for (const f of files) await uploadImage(f);
      notify(files.length > 1 ? `Đã tải lên ${files.length} ảnh` : 'Đã tải ảnh lên');
      setPage(1);
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Thư viện ảnh"
        actions={
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              aria-label="Tải ảnh lên"
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = '';
              }}
            />
            <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Đang tải lên…' : 'Tải ảnh lên'}
            </Button>
          </>
        }
      />
      <p className="mb-4 text-sm text-muted">JPG, PNG, WebP, GIF, tối đa 10 MB. Ảnh lớn được thu nhỏ về 2400px và bỏ dữ liệu EXIF. Trong trình soạn bài, bạn cũng có thể dán hoặc kéo-thả ảnh trực tiếp.</p>
      <ErrorNote message={err ?? error} />
      {data?.length === 0 && <p className="py-10 text-center text-muted">Chưa có ảnh nào.</p>}
      {!data && loading && <p className="py-10 text-center text-muted">Đang tải…</p>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.map((m) => <Card key={`${m.id}-${m.alt}`} m={m} onChanged={reload} />)}</ul>
      {meta && meta.total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{meta.total} ảnh</span>
          <div className="flex items-center gap-2">
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</Button>
            <span>{page} / {totalPages}</span>
            <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</Button>
          </div>
        </div>
      )}
    </>
  );
}
