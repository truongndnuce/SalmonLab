'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Button, ErrorNote, Field, inputCls, PageHeader } from '@/admin/components/ui';
import { errorMessage, put } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import type { AdminPage } from '@/admin/lib/types';
import { useAdminData } from '@/admin/lib/use-admin-data';

const MarkdownEditor = dynamic(() => import('@/admin/components/MarkdownEditor'), {
  ssr: false,
  loading: () => <div className="min-h-[360px] rounded-md border border-border" />,
});

export default function PagesAdminPage() {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAdminData<AdminPage[]>('/admin/pages');
  const about = data?.find((p) => p.slug === 'about');

  const [title, setTitle] = useState('Giới thiệu');
  const [body, setBody] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!data || loaded) return;
    setTitle(about?.title ?? 'Giới thiệu');
    setBody(about?.bodyMd ?? '');
    setSaved(JSON.stringify([about?.title ?? 'Giới thiệu', about?.bodyMd ?? '']));
    setLoaded(true);
  }, [data, about, loaded]);

  const dirty = loaded && JSON.stringify([title, body]) !== saved;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await put('/admin/pages/about', { title: title.trim(), bodyMd: body });
      setSaved(JSON.stringify([title, body]));
      notify('Đã lưu trang Giới thiệu');
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
        title="Trang tĩnh: Giới thiệu"
        actions={
          <>
            <a href="/about" target="_blank" rel="noopener" className="text-sm text-accent hover:underline">Xem trang ↗</a>
            <Button variant="primary" disabled={busy || !dirty || !title.trim()} onClick={() => void save()}>Lưu</Button>
          </>
        }
      />
      <ErrorNote message={error ?? err} />
      {!loaded && loading ? (
        <p className="text-muted">Đang tải…</p>
      ) : (
        <div className="space-y-4">
          <Field label="Tiêu đề">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <MarkdownEditor value={body} onChange={setBody} minHeight="360px" />
        </div>
      )}
    </>
  );
}
