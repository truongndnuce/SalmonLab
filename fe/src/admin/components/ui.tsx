'use client';

import { useEffect, useState } from 'react';
import { displayStatus, type Status } from '../lib/types';

export const inputCls =
  'w-full rounded-md border border-border bg-bg px-3 py-1.5 text-[15px] placeholder:text-muted/70 focus:border-accent disabled:bg-surface-note disabled:text-muted';

const variants = {
  primary: 'border-accent bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50',
  secondary: 'border-border bg-bg text-fg hover:border-accent hover:text-accent disabled:opacity-50',
  danger: 'border-red-300 bg-bg text-danger hover:bg-surface-note disabled:opacity-50',
  ghost: 'border-transparent text-muted hover:text-accent disabled:opacity-50',
} as const;

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const badge = {
  DRAFT: ['Nháp', 'bg-surface-note text-muted border-border'],
  PUBLISHED: ['Đã đăng', 'bg-green-50 text-green-800 border-green-200'],
  SCHEDULED: ['Hẹn giờ', 'bg-amber-50 text-amber-800 border-amber-200'],
  ARCHIVED: ['Lưu trữ', 'bg-surface-note text-muted border-border'],
} as const;

export function StatusBadge({ status, publishedAt }: { status: Status; publishedAt: string | null }) {
  const [label, cls] = badge[displayStatus(status, publishedAt)];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

/** Two-step delete without a native confirm() dialog: first click arms it, second click confirms. */
export function ConfirmButton({
  onConfirm,
  children = 'Xoá',
  disabled,
}: {
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      variant="danger"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          void onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? 'Bấm lần nữa để xoá' : children}
    </Button>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

export const shortDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
    : '—';
