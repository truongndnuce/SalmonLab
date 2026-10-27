'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button, ErrorNote, Field, inputCls, PageHeader } from '@/admin/components/ui';
import { adminFetch, errorMessage } from '@/admin/lib/api';
import type { AdminPost } from '@/admin/lib/types';

interface Result {
  post: AdminPost;
  outcome: 'created' | 'renamed' | 'overwritten';
  uploadedImages: number;
  warnings: string[];
}

const OUTCOME = {
  created: 'Đã tạo bản nháp mới',
  renamed: 'Slug đã tồn tại nên bài được tạo với slug mới',
  overwritten: 'Đã ghi đè bài cùng slug',
} as const;

export default function ImportPage() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [onConflict, setOnConflict] = useState<'rename' | 'overwrite' | 'reject'>('rename');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('onConflict', onConflict);
      const { data, meta } = await adminFetch<AdminPost>('/admin/import', { method: 'POST', body: form });
      const m = meta as unknown as Omit<Result, 'post'>;
      setResults((r) => [{ post: data, ...m }, ...r]);
      setFile(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Nhập bài từ file" actions={<Link href="/admin/posts" className="text-sm text-muted hover:text-accent">← Danh sách</Link>} />
      <div className="max-w-2xl space-y-4">
        <p className="text-sm text-muted">
          Chọn file <code>.md</code> (có thể có front matter YAML: <code>title, slug, description, tags, categories, date</code>) hoặc <code>.zip</code> chứa một file <code>.md</code> cùng ảnh đi kèm (ảnh được tải lên thư viện và sửa đường dẫn tự động). Bài luôn được tạo ở dạng <strong>bản nháp</strong> để bạn xem lại trước khi xuất bản. Tối đa 20 MB.
        </p>
        <ErrorNote message={error} />
        <div className="space-y-3 rounded-card border border-border bg-surface p-4">
          <input
            ref={input}
            type="file"
            accept=".md,.markdown,.txt,.zip"
            className="hidden"
            aria-label="Chọn file để nhập"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-3">
            <Button onClick={() => input.current?.click()}>Chọn file…</Button>
            <span className="truncate text-sm">{file ? file.name : 'Chưa chọn file'}</span>
          </div>
          <Field label="Khi slug đã tồn tại">
            <select className={inputCls} value={onConflict} onChange={(e) => setOnConflict(e.target.value as typeof onConflict)}>
              <option value="rename">Tạo bài mới với slug khác (an toàn)</option>
              <option value="reject">Báo lỗi, không nhập</option>
              <option value="overwrite">Ghi đè bài đang có (nội dung cũ sẽ mất)</option>
            </select>
          </Field>
          <Button variant="primary" disabled={!file || busy} onClick={() => void submit()}>
            {busy ? 'Đang nhập…' : 'Nhập'}
          </Button>
        </div>

        {results.length > 0 && (
          <ul className="space-y-3" aria-label="Kết quả nhập">
            {results.map((r) => (
              <li key={r.post.id} className="rounded-card border border-border p-4">
                <p className="font-medium">{OUTCOME[r.outcome]}</p>
                <Link href={`/admin/posts/${r.post.id}`} className="text-accent hover:underline">{r.post.title}</Link>
                <span className="ml-2 text-xs text-muted">/{r.post.slug}{r.uploadedImages ? ` · ${r.uploadedImages} ảnh đã tải lên` : ''}</span>
                {r.warnings.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-warn">
                    {r.warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
