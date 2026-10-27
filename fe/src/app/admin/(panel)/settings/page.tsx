'use client';

import { useEffect, useState } from 'react';
import MediaPicker from '@/admin/components/MediaPicker';
import { Button, ErrorNote, Field, inputCls, PageHeader } from '@/admin/components/ui';
import { errorMessage, put } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import { useAdminData } from '@/admin/lib/use-admin-data';

interface Site {
  name: string;
  tagline: string;
  coverUrl: string | null;
}

export default function SettingsAdminPage() {
  const { notify } = useToast();
  const { data, error, reload } = useAdminData<Site>('/admin/settings');
  const [form, setForm] = useState<Site | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const dirty = !!form && !!data && JSON.stringify(form) !== JSON.stringify(data);

  async function save() {
    if (!form) return;
    setBusy(true);
    setErr(null);
    try {
      await put('/admin/settings', { name: form.name, tagline: form.tagline, coverUrl: form.coverUrl ?? '' });
      notify('Đã lưu cài đặt');
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Cài đặt site" actions={<Button variant="primary" disabled={!dirty || busy || !form?.name.trim()} onClick={() => void save()}>Lưu</Button>} />
      <ErrorNote message={error ?? err} />
      {!form ? (
        <p className="text-muted">Đang tải…</p>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Field label="Tên site">
            <input className={inputCls} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Giới thiệu ngắn (tagline)" hint="Hiện ở trang chủ, thẻ mô tả SEO và RSS.">
            <textarea className={inputCls} rows={3} maxLength={300} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">Ảnh bìa trang chủ</p>
            {form.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview
              <img src={form.coverUrl} alt="" className="w-full max-w-[480px] rounded-card border border-border" />
            )}
            <div className="flex gap-2">
              <Button onClick={() => setPicker(true)}>Chọn / tải ảnh</Button>
              {form.coverUrl && <Button variant="ghost" onClick={() => setForm({ ...form, coverUrl: null })}>Bỏ ảnh</Button>}
            </div>
          </div>
          {picker && (
            <MediaPicker
              onClose={() => setPicker(false)}
              onSelect={(m) => {
                setForm({ ...form, coverUrl: m.url });
                setPicker(false);
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
