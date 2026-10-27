'use client';

import { useEffect, useState } from 'react';
import { Button, ConfirmButton, ErrorNote, Field, inputCls, PageHeader, StatusBadge } from '@/admin/components/ui';
import { del, errorMessage, patch, post, put } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import type { AdminSeries } from '@/admin/lib/types';
import { useAdminData } from '@/admin/lib/use-admin-data';

function SeriesDetail({ id, onChanged, onDeleted }: { id: string; onChanged: () => void; onDeleted: () => void }) {
  const { notify } = useToast();
  const { data, error, reload } = useAdminData<AdminSeries>(`/admin/series/${id}`);
  const [form, setForm] = useState({ title: '', description: '', coverUrl: '', featured: false, featuredOrder: '' });
  const [order, setOrder] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      title: data.title,
      description: data.description ?? '',
      coverUrl: data.coverUrl ?? '',
      featured: data.featured,
      featuredOrder: data.featuredOrder?.toString() ?? '',
    });
    setOrder((data.posts ?? []).map((p) => p.id));
  }, [data]);

  if (!data) return error ? <ErrorNote message={error} /> : <p className="text-muted">Đang tải…</p>;

  const byId = new Map((data.posts ?? []).map((p) => [p.id, p]));
  const move = (i: number, delta: number) =>
    setOrder((o) => {
      const next = [...o];
      const j = i + delta;
      if (j < 0 || j >= next.length) return o;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const moveTo = (from: number, to: number) =>
    setOrder((o) => {
      if (from === to || to < 0 || to >= o.length) return o;
      const next = [...o];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  const orderChanged = order.join() !== (data.posts ?? []).map((p) => p.id).join();

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setErr(null);
    try {
      await fn();
      notify(okText);
      reload();
      onChanged();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <ErrorNote message={err} />
      <section className="space-y-3 rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Thông tin</h2>
        <Field label="Tên loạt bài">
          <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Mô tả">
          <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="URL ảnh bìa">
          <input className={inputCls} type="url" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Hiển thị ở mục “Nổi bật”
          </label>
          {form.featured && (
            <label className="flex items-center gap-2 text-sm">
              Thứ tự
              <input className={`${inputCls} !w-20`} type="number" min={1} value={form.featuredOrder} onChange={(e) => setForm({ ...form, featuredOrder: e.target.value })} />
            </label>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={!form.title.trim()}
            onClick={() =>
              void run(
                () =>
                  patch(`/admin/series/${id}`, {
                    title: form.title.trim(),
                    description: form.description.trim() || null,
                    coverUrl: form.coverUrl.trim() || null,
                    featured: form.featured,
                    featuredOrder: form.featured && form.featuredOrder ? Number(form.featuredOrder) : null,
                  }),
                'Đã lưu loạt bài',
              )
            }
          >
            Lưu
          </Button>
          <ConfirmButton
            onConfirm={() =>
              run(async () => {
                await del(`/admin/series/${id}`);
                onDeleted();
              }, 'Đã xoá loạt bài')
            }
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Thứ tự bài viết <span className="font-normal normal-case tracking-normal text-muted">(kéo-thả hoặc dùng nút ↑↓)</span></h2>
        {order.length === 0 ? (
          <p className="text-sm text-muted">Chưa có bài nào. Gán bài vào loạt bài từ trang sửa bài viết.</p>
        ) : (
          <ol className="space-y-1.5">
            {order.map((pid, i) => {
              const p = byId.get(pid)!;
              return (
                <li
                  key={pid}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom !== null) moveTo(dragFrom, i);
                    setDragFrom(null);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  className={`flex cursor-grab items-center gap-3 rounded-md border bg-bg px-3 py-1.5 text-sm ${dragFrom === i ? 'border-accent opacity-60' : 'border-border'}`}
                >
                  <span aria-hidden className="text-muted">⠿</span>
                  <span className="w-6 tabular-nums text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <StatusBadge status={p.status} publishedAt={null} />
                  <Button variant="ghost" aria-label={`Đưa “${p.title}” lên`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                  <Button variant="ghost" aria-label={`Đưa “${p.title}” xuống`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</Button>
                </li>
              );
            })}
          </ol>
        )}
        {order.length > 1 && (
          <Button className="mt-3" variant="primary" disabled={!orderChanged} onClick={() => void run(() => put(`/admin/series/${id}/order`, { postIds: order }), 'Đã lưu thứ tự')}>
            Lưu thứ tự
          </Button>
        )}
      </section>
    </div>
  );
}

export default function SeriesAdminPage() {
  const { notify } = useToast();
  const list = useAdminData<AdminSeries[]>('/admin/series');
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    try {
      const { data } = await post<AdminSeries>('/admin/series', { title: title.trim() });
      setTitle('');
      setSelected(data.id);
      notify('Đã tạo loạt bài');
      list.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title="Loạt bài" />
      <ErrorNote message={error ?? list.error} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) void create();
            }}
          >
            <input aria-label="Tên loạt bài mới" className={inputCls} placeholder="Tên loạt bài mới" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button type="submit" variant="primary" disabled={!title.trim()}>Thêm</Button>
          </form>
          <ul className="space-y-1.5">
            {list.data?.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  aria-pressed={selected === s.id}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selected === s.id ? 'border-accent bg-bg font-semibold text-accent' : 'border-border bg-surface hover:border-accent'}`}
                >
                  {s.title}
                  <span className="ml-2 text-xs font-normal text-muted">{s.postCount ?? 0} bài{s.featured ? ' · nổi bật' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
          {list.data?.length === 0 && <p className="text-sm text-muted">Chưa có loạt bài nào.</p>}
        </div>
        <div>
          {selected ? (
            <SeriesDetail
              key={selected}
              id={selected}
              onChanged={list.reload}
              onDeleted={() => {
                setSelected(null);
                list.reload();
              }}
            />
          ) : (
            <p className="text-muted">Chọn một loạt bài để chỉnh sửa và sắp xếp.</p>
          )}
        </div>
      </div>
    </>
  );
}
