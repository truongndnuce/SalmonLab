'use client';

import { useState } from 'react';
import { Button, ConfirmButton, ErrorNote, inputCls, PageHeader } from '@/admin/components/ui';
import { del, errorMessage, patch, post } from '@/admin/lib/api';
import { useToast } from '@/admin/lib/toast';
import type { Taxon } from '@/admin/lib/types';
import { useAdminData } from '@/admin/lib/use-admin-data';

function Row({ item, base, onChanged }: { item: Taxon; base: string; onChanged: () => void }) {
  const { notify } = useToast();
  const [name, setName] = useState(item.name);
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

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <input aria-label={`Tên ${item.slug}`} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        <code className="hidden text-xs text-muted sm:block">{item.slug}</code>
        <Button disabled={!name.trim() || name.trim() === item.name} onClick={() => void run(() => patch(`${base}/${item.id}`, { name: name.trim() }), 'Đã đổi tên')}>
          Lưu
        </Button>
        <ConfirmButton onConfirm={() => run(() => del(`${base}/${item.id}`), 'Đã xoá')} />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </li>
  );
}

function Section({ title, base, noun }: { title: string; base: string; noun: string }) {
  const { notify } = useToast();
  const { data, error, reload } = useAdminData<Taxon[]>(base);
  const [name, setName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  async function add() {
    setAddError(null);
    try {
      await post(base, { name: name.trim() });
      setName('');
      notify(`Đã thêm ${noun}`);
      reload();
    } catch (e) {
      setAddError(errorMessage(e));
    }
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">{title}</h2>
      <ErrorNote message={error ?? addError} />
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void add();
        }}
      >
        <input aria-label={`Tên ${noun} mới`} className={inputCls} placeholder={`Tên ${noun} mới`} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="primary" disabled={!name.trim()}>Thêm</Button>
      </form>
      <ul className="divide-y divide-border">
        {data?.map((t) => <Row key={`${t.id}-${t.name}`} item={t} base={base} onChanged={reload} />)}
      </ul>
      {data?.length === 0 && <p className="text-sm text-muted">Chưa có {noun} nào.</p>}
    </section>
  );
}

export default function TaxonomyAdminPage() {
  return (
    <>
      <PageHeader title="Danh mục & thẻ" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Danh mục" base="/admin/categories" noun="danh mục" />
        <Section title="Thẻ" base="/admin/tags" noun="thẻ" />
      </div>
      <p className="mt-4 text-xs text-muted">Đổi slug sẽ không tự chuyển hướng. Xoá danh mục chỉ bỏ liên kết khỏi bài viết, không xoá bài.</p>
    </>
  );
}
