'use client';

import { useEffect, useRef, useState } from 'react';
import { errorMessage, uploadImage } from '../lib/api';
import type { AdminMedia } from '../lib/types';
import { useAdminData } from '../lib/use-admin-data';
import { Button, ErrorNote } from './ui';

interface Props {
  onSelect: (media: AdminMedia) => void;
  onClose: () => void;
}

/** Modal grid of uploaded images; picking one (or uploading a new one) hands it to `onSelect`. */
export default function MediaPicker({ onSelect, onClose }: Props) {
  const [page, setPage] = useState(1);
  const { data, meta, error, reload } = useAdminData<AdminMedia[]>(`/admin/media?page=${page}&pageSize=24`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const { data: m } = await uploadImage(file);
      onSelect(m);
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Chọn ảnh">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-card bg-bg p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Chọn ảnh</h2>
          <div className="flex items-center gap-2">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              aria-label="Tải ảnh lên"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
            <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Đang tải lên…' : 'Tải ảnh mới'}
            </Button>
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </div>
        <ErrorNote message={err ?? error} />
        <div className="overflow-y-auto">
          {data?.length === 0 && <p className="py-10 text-center text-muted">Chưa có ảnh nào. Hãy tải ảnh đầu tiên lên.</p>}
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {data?.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m)}
                  className="block w-full overflow-hidden rounded-md border border-border hover:border-accent focus-visible:border-accent"
                  title={m.alt ?? m.key}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails from the media bucket */}
                  <img src={m.url} alt={m.alt ?? ''} loading="lazy" className="aspect-square w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        {meta && meta.total > meta.pageSize && (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted">
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</Button>
            <span>{page} / {totalPages}</span>
            <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</Button>
          </div>
        )}
        <button type="button" className="sr-only" onClick={reload}>Tải lại</button>
      </div>
    </div>
  );
}
