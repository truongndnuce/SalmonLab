'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { del, errorMessage, patch, post } from '../lib/api';
import { useToast } from '../lib/toast';
import type { AdminPost, AdminSeries, Taxon } from '../lib/types';
import { useAdminData } from '../lib/use-admin-data';
import { Button, ConfirmButton, ErrorNote, Field, inputCls, PageHeader, StatusBadge } from './ui';
import MediaPicker from './MediaPicker';
import { WidgetPanel } from './WidgetPanel';
import { TagInput } from './TagInput';

const MarkdownEditor = dynamic(() => import('./MarkdownEditor'), {
  ssr: false,
  loading: () => <div className="grid min-h-[480px] place-items-center rounded-md border border-border text-muted">Đang tải trình soạn thảo…</div>,
});

interface Form {
  kind: 'POST' | 'INFOGRAPHIC';
  title: string;
  slug: string;
  excerpt: string;
  bodyMd: string;
  coverUrl: string;
  coverAlt: string;
  categoryId: string;
  tags: string[];
  seriesId: string;
  seriesOrder: string;
  featured: boolean;
}

const EMPTY: Form = {
  kind: 'POST', title: '', slug: '', excerpt: '', bodyMd: '', coverUrl: '', coverAlt: '',
  categoryId: '', tags: [], seriesId: '', seriesOrder: '', featured: false,
};

const toForm = (p: AdminPost): Form => ({
  kind: p.kind,
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt ?? '',
  bodyMd: p.bodyMd ?? '',
  coverUrl: p.coverUrl ?? '',
  coverAlt: p.coverAlt ?? '',
  categoryId: p.category?.id ?? '',
  tags: p.tags.map((t) => t.name),
  seriesId: p.series?.id ?? '',
  seriesOrder: p.seriesOrder?.toString() ?? '',
  featured: p.featured,
});

const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

function toPayload(f: Form, { includeSlug }: { includeSlug: boolean }) {
  return {
    kind: f.kind,
    title: f.title.trim(),
    ...(includeSlug && f.slug.trim() && { slug: f.slug.trim() }),
    excerpt: orNull(f.excerpt),
    bodyMd: f.bodyMd,
    coverUrl: orNull(f.coverUrl),
    coverAlt: orNull(f.coverAlt),
    categoryId: orNull(f.categoryId),
    tags: f.tags,
    seriesId: orNull(f.seriesId),
    seriesOrder: f.seriesOrder.trim() === '' ? null : Number(f.seriesOrder),
    featured: f.featured,
  };
}

const AUTOSAVE_MS = 10_000;

export function PostEditor({ id }: { id: string }) {
  const isNew = id === 'new';
  const router = useRouter();
  const { notify } = useToast();

  const existing = useAdminData<AdminPost>(isNew ? null : `/admin/posts/${id}`);
  const categories = useAdminData<Taxon[]>('/admin/categories');
  const tags = useAdminData<Taxon[]>('/admin/tags');
  const series = useAdminData<AdminSeries[]>('/admin/series');

  const [coverPicker, setCoverPicker] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [record, setRecord] = useState<AdminPost | null>(null);
  const [saved, setSaved] = useState<string>(JSON.stringify(EMPTY));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const loadedId = useRef<string | null>(null);

  // Load the record once per id; later reloads must not clobber unsaved edits.
  useEffect(() => {
    if (existing.data && loadedId.current !== existing.data.id) {
      loadedId.current = existing.data.id;
      setRecord(existing.data);
      const f = toForm(existing.data);
      setForm(f);
      setSaved(JSON.stringify(f));
    }
  }, [existing.data]);

  const dirty = useMemo(() => JSON.stringify(form) !== saved, [form, saved]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  // Renaming a public post is allowed: the API keeps the old URL as a 301 redirect.
  const slugRenamed = !!record?.publishedAt && form.slug !== record.slug;
  const isLive = record?.status === 'PUBLISHED';

  const sync = useCallback((p: AdminPost) => {
    setRecord(p);
    const f = toForm(p);
    setForm(f);
    setSaved(JSON.stringify(f));
    setLastSaved(new Date());
  }, []);

  /** Saves the form: creates the draft on first save, patches afterwards. Returns the saved record or null on error. */
  const save = useCallback(
    async (silent = false): Promise<AdminPost | null> => {
      if (!form.title.trim()) {
        setError('Cần nhập tiêu đề trước khi lưu.');
        return null;
      }
      setError(null);
      try {
        if (!record) {
          const { data } = await post<AdminPost>('/admin/posts', toPayload(form, { includeSlug: true }));
          loadedId.current = data.id;
          sync(data);
          router.replace(`/admin/posts/${data.id}`);
          if (!silent) notify('Đã lưu bản nháp');
          return data;
        }
        const { data } = await patch<AdminPost>(`/admin/posts/${record.id}`, toPayload(form, { includeSlug: true }));
        sync(data);
        if (!silent) notify('Đã lưu');
        return data;
      } catch (e) {
        setError(errorMessage(e));
        return null;
      }
    },
    [form, record, sync, router, notify],
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Autosave drafts only: saving a live post would change the public site every few seconds.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!record || isLive || !dirty || busy) return;
    const t = setTimeout(() => void saveRef.current(true), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [record, isLive, dirty, busy, form]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const publish = () =>
    run(async () => {
      const p = dirty || !record ? await save(true) : record;
      if (!p) return;
      const { data } = await post<AdminPost>(`/admin/posts/${p.id}/publish`);
      sync(data);
      notify('Đã xuất bản');
    });

  const unpublish = () =>
    run(async () => {
      if (!record) return;
      const { data } = await post<AdminPost>(`/admin/posts/${record.id}/unpublish`);
      sync(data);
      notify('Đã gỡ về bản nháp');
    });

  const schedule = () =>
    run(async () => {
      if (!scheduleAt) return setError('Chọn thời điểm đăng.');
      const p = dirty || !record ? await save(true) : record;
      if (!p) return;
      const { data } = await post<AdminPost>(`/admin/posts/${p.id}/schedule`, { publishedAt: new Date(scheduleAt).toISOString() });
      sync(data);
      notify('Đã hẹn giờ đăng');
    });

  const remove = () =>
    run(async () => {
      if (!record) return;
      await del(`/admin/posts/${record.id}`);
      setSaved(JSON.stringify(form)); // avoid the unload warning
      notify('Đã xoá bài viết');
      router.replace('/admin/posts');
    });

  if (!isNew && existing.loading && !record) return <p className="text-muted">Đang tải…</p>;
  if (!isNew && existing.error && !record) return <ErrorNote message={existing.error} />;

  const publicHref = record ? `${record.kind === 'POST' ? '/posts' : '/infographic'}/${record.slug}` : null;

  return (
    <>
      <PageHeader
        title={isNew && !record ? 'Bài viết mới' : 'Sửa bài viết'}
        actions={
          <>
            {record && <StatusBadge status={record.status} publishedAt={record.publishedAt} />}
            {publicHref && isLive && (
              <a href={publicHref} target="_blank" rel="noopener" className="text-sm text-accent hover:underline">
                Xem bài ↗
              </a>
            )}
            <Link href="/admin/posts" className="text-sm text-muted hover:text-accent">
              ← Danh sách
            </Link>
          </>
        }
      />
      <ErrorNote message={error} />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <input
            aria-label="Tiêu đề"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-2xl font-bold placeholder:text-muted/60 focus:border-accent"
            placeholder="Tiêu đề bài viết"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
          <MarkdownEditor value={form.bodyMd} onChange={(v) => set('bodyMd', v)} />
        </div>

        <aside className="space-y-5">
          <section className="space-y-3 rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Xuất bản</h2>
            <p className="text-xs text-muted" aria-live="polite">
              {dirty ? 'Có thay đổi chưa lưu' : lastSaved ? `Đã lưu lúc ${lastSaved.toLocaleTimeString('vi-VN')}` : record ? 'Đã đồng bộ' : 'Chưa lưu'}
              {!isLive && record && dirty ? ' · tự lưu sau 10 giây' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || (!dirty && !!record)} onClick={() => void run(async () => void (await save()))}>
                Lưu{isLive ? '' : ' nháp'}
              </Button>
              {!isLive && (
                <Button variant="primary" disabled={busy} onClick={() => void publish()}>
                  Xuất bản
                </Button>
              )}
              {isLive && (
                <Button disabled={busy} onClick={() => void unpublish()}>
                  Gỡ xuất bản
                </Button>
              )}
            </div>
            {!isLive && (
              <div className="border-t border-border pt-3">
                <Field label="Hẹn giờ đăng">
                  <input className={inputCls} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                </Field>
                <Button className="mt-2" disabled={busy || !scheduleAt} onClick={() => void schedule()}>
                  Hẹn giờ
                </Button>
              </div>
            )}
            {record && (
              <div className="border-t border-border pt-3">
                <ConfirmButton disabled={busy} onConfirm={remove}>
                  Xoá bài viết
                </ConfirmButton>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Thông tin</h2>
            <Field label="Loại">
              <select className={inputCls} value={form.kind} onChange={(e) => set('kind', e.target.value as Form['kind'])}>
                <option value="POST">Bài viết</option>
                <option value="INFOGRAPHIC">Infographic</option>
              </select>
            </Field>
            <Field label="Slug" hint={slugRenamed ? 'Đổi slug: địa chỉ cũ sẽ tự chuyển hướng (301) tới địa chỉ mới.' : 'Để trống để tự sinh từ tiêu đề.'}>
              <input
                className={inputCls}
                value={form.slug}
                placeholder="tu-sinh-tu-tieu-de"
                onChange={(e) => set('slug', e.target.value)}
              />
            </Field>
            <Field label="Mô tả ngắn (SEO)">
              <textarea className={inputCls} rows={3} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
            </Field>
            <Field label="Danh mục">
              <select className={inputCls} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">— Không —</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Thẻ">
              <TagInput value={form.tags} onChange={(t) => set('tags', t)} suggestions={tags.data?.map((t) => t.name) ?? []} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
              Hiển thị ở mục “Nổi bật”
            </label>
          </section>

          <section className="space-y-3 rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Loạt bài</h2>
            <Field label="Thuộc loạt bài">
              <select className={inputCls} value={form.seriesId} onChange={(e) => set('seriesId', e.target.value)}>
                <option value="">— Không —</option>
                {series.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            {form.seriesId && (
              <Field label="Thứ tự trong loạt">
                <input className={inputCls} type="number" min={1} value={form.seriesOrder} onChange={(e) => set('seriesOrder', e.target.value)} />
              </Field>
            )}
          </section>

          {record ? (
            <WidgetPanel postId={record.id} onInsert={(d) => set('bodyMd', `${form.bodyMd.replace(/\s*$/, '')}\n\n${d}\n`)} />
          ) : (
            <p className="rounded-card border border-dashed border-border p-3 text-xs text-muted">Lưu bản nháp một lần để tải widget tương tác lên bài này.</p>
          )}

          <section className="space-y-3 rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Ảnh bìa</h2>
            {form.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary cover URL
              <img src={form.coverUrl} alt="" className="aspect-video w-full rounded-md border border-border object-cover" />
            )}
            <div className="flex gap-2">
              <Button onClick={() => setCoverPicker(true)}>Chọn / tải ảnh</Button>
              {form.coverUrl && <Button variant="ghost" onClick={() => { set('coverUrl', ''); set('coverAlt', ''); }}>Bỏ ảnh</Button>}
            </div>
            <Field label="Hoặc nhập URL ảnh">
              <input className={inputCls} type="url" value={form.coverUrl} placeholder="https://…" onChange={(e) => set('coverUrl', e.target.value)} />
            </Field>
            {coverPicker && (
              <MediaPicker
                onClose={() => setCoverPicker(false)}
                onSelect={(m) => {
                  set('coverUrl', m.url);
                  if (m.alt && !form.coverAlt) set('coverAlt', m.alt);
                  setCoverPicker(false);
                }}
              />
            )}
            <Field label="Mô tả ảnh (alt)">
              <input className={inputCls} value={form.coverAlt} onChange={(e) => set('coverAlt', e.target.value)} />
            </Field>
          </section>
        </aside>
      </div>
    </>
  );
}
