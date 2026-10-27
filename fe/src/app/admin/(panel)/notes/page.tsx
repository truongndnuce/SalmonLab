'use client';

import { useState } from 'react';
import { TagInput } from '@/admin/components/TagInput';
import { Button, ConfirmButton, ErrorNote, inputCls, PageHeader, shortDate, StatusBadge } from '@/admin/components/ui';
import { del, errorMessage, patch, post } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import type { AdminNote, Taxon } from '@/admin/lib/types';
import { useAdminData } from '@/admin/lib/use-admin-data';

const PAGE_SIZE = 20;

const useTagNames = () => useAdminData<Taxon[]>('/admin/tags').data?.map((t) => t.name) ?? [];

function Composer({ onCreated }: { onCreated: () => void }) {
  const { notify } = useToast();
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const known = useTagNames();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(publish: boolean) {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await post('/admin/notes', { bodyMd: body, publish, tags });
      setBody('');
      setTags([]);
      notify(publish ? 'Đã đăng ghi chú' : 'Đã lưu nháp');
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-card border border-border bg-surface p-4">
      <ErrorNote message={error} />
      <textarea
        aria-label="Nội dung ghi chú"
        className={inputCls}
        rows={4}
        placeholder="Viết nhanh một ghi chú… (Ctrl/⌘ + Enter để đăng)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void create(true);
          }
        }}
      />
      <div className="mt-3">
        <TagInput value={tags} onChange={setTags} suggestions={known} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={busy || !body.trim()} onClick={() => void create(true)}>
          Đăng
        </Button>
        <Button disabled={busy || !body.trim()} onClick={() => void create(false)}>
          Lưu nháp
        </Button>
      </div>
    </section>
  );
}

function NoteRow({ note, onChanged }: { note: AdminNote; onChanged: () => void }) {
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.bodyMd);
  const [tags, setTags] = useState(note.tags.map((t) => t.name));
  const known = useTagNames();
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    setError(null);
    try {
      await fn();
      notify(okText);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <li className="rounded-card border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <StatusBadge status={note.status} publishedAt={note.publishedAt} />
        <time>{shortDate(note.publishedAt ?? note.createdAt)}</time>
        <code className="rounded bg-surface-note px-1.5">{note.slug}</code>
      </div>
      <ErrorNote message={error} />
      {editing ? (
        <>
          <textarea aria-label="Sửa ghi chú" className={inputCls} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="mt-2">
            <TagInput value={tags} onChange={setTags} suggestions={known} />
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              disabled={!body.trim()}
              onClick={() => void act(async () => { await patch(`/admin/notes/${note.id}`, { bodyMd: body, tags }); setEditing(false); }, 'Đã lưu')}
            >
              Lưu
            </Button>
            <Button onClick={() => { setEditing(false); setBody(note.bodyMd); setTags(note.tags.map((t) => t.name)); }}>Huỷ</Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words">{note.bodyMd}</p>
          {note.tags.length > 0 && <p className="mt-2 text-xs text-muted">{note.tags.map((t) => `#${t.name}`).join(' ')}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)}>Sửa</Button>
            {note.status === 'PUBLISHED' ? (
              <Button onClick={() => void act(() => post(`/admin/notes/${note.id}/unpublish`), 'Đã gỡ về nháp')}>Gỡ</Button>
            ) : (
              <Button onClick={() => void act(() => post(`/admin/notes/${note.id}/publish`), 'Đã đăng')}>Đăng</Button>
            )}
            <ConfirmButton onConfirm={() => act(() => del(`/admin/notes/${note.id}`), 'Đã xoá ghi chú')} />
          </div>
        </>
      )}
    </li>
  );
}

export default function NotesAdminPage() {
  const [page, setPage] = useState(1);
  const { data, meta, error, loading, reload } = useAdminData<AdminNote[]>(`/admin/notes?page=${page}&pageSize=${PAGE_SIZE}`);
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Ghi chú" />
      <Composer
        onCreated={() => {
          setPage(1);
          reload();
        }}
      />
      <ErrorNote message={error} />
      <ul className="space-y-3">
        {data?.map((n) => <NoteRow key={`${n.id}-${n.updatedAt}`} note={n} onChanged={reload} />)}
      </ul>
      {data?.length === 0 && <p className="py-10 text-center text-muted">Chưa có ghi chú nào.</p>}
      {!data && loading && <p className="py-10 text-center text-muted">Đang tải…</p>}
      {meta && meta.total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{meta.total} ghi chú</span>
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
