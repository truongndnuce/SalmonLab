'use client';

import { useRef, useState } from 'react';
import { del, errorMessage, uploadFile } from '../lib/api';
import { useToast } from '../lib/toast';
import type { AdminWidget } from '../lib/types';
import { useAdminData } from '../lib/use-admin-data';
import { Button, ConfirmButton, ErrorNote, Field, inputCls } from './ui';

export const AI_PROMPT = `Hãy tạo MỘT file HTML duy nhất (HTML + CSS + JavaScript thuần, không framework,
không gọi mạng, không dùng thư viện ngoài) minh họa: <chủ đề, ví dụ: polling vs push>.

Yêu cầu:
- Hoạt ảnh/sơ đồ SVG tương tác: có nút Chạy/Dừng/Đặt lại và 1-2 tham số chỉnh được.
- Chỉ dùng CSS variables: --bg, --fg, --accent, --muted, --border (đừng hard-code màu);
  hỗ trợ cả light và dark qua thuộc tính data-theme trên <html>.
- Chữ tiếng Việt, phông hệ thống, cỡ chữ >= 14px, responsive từ 320px.
- Không dùng localStorage, cookie, fetch, XMLHttpRequest, WebSocket, iframe, form.
- Ảnh/phông phải là data: URI hoặc inline SVG; script ngoài chỉ được từ cdnjs.cloudflare.com.
- Tôn trọng prefers-reduced-motion (tắt/giảm hoạt ảnh).
- Có aria-label/nhãn chữ cho các điều khiển.
- Chiều rộng 100%, không cố định pixel; tự tính chiều cao theo nội dung.
- Trả về duy nhất khối code HTML hoàn chỉnh.`;

interface Props {
  postId: string;
  /** Appends a directive to the post body (the editor owns the text). */
  onInsert: (directive: string) => void;
}

/** Upload/manage the widgets of one post and insert their `::widget` directive. */
export function WidgetPanel({ postId, onInsert }: Props) {
  const { notify } = useToast();
  const { data, error, reload } = useAdminData<AdminWidget[]>(`/admin/posts/${postId}/widgets`);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const directiveOf = (w: AdminWidget) => `::widget{src="${w.url}" height="420" title="${w.title.replace(/"/g, "'")}"}`;

  async function upload() {
    if (!file || !title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { data: w } = await uploadFile<AdminWidget & { directive: string }>(`/admin/posts/${postId}/widgets`, file, { title: title.trim() });
      notify('Đã tải widget lên');
      onInsert(w.directive);
      setFile(null);
      setTitle('');
      reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Widget tương tác</h2>
      <ErrorNote message={err ?? error} />
      <ul className="space-y-2">
        {data?.map((w) => (
          <li key={w.id} className="rounded-md border border-border bg-bg p-2 text-sm">
            <p className="font-medium">{w.title}</p>
            <p className="truncate text-xs text-muted">{w.name} · {Math.round(w.size / 1024)} KB</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => onInsert(directiveOf(w))}>Chèn vào bài</Button>
              <ConfirmButton
                onConfirm={async () => {
                  try {
                    await del(`/admin/posts/${postId}/widgets/${w.name}`);
                    notify('Đã xoá widget');
                    reload();
                  } catch (e) {
                    setErr(errorMessage(e));
                  }
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <input ref={input} type="file" accept=".html,text/html" className="hidden" aria-label="Chọn file widget" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center gap-2">
        <Button onClick={() => input.current?.click()}>Chọn file .html</Button>
        <span className="truncate text-xs text-muted">{file?.name ?? 'Chưa chọn'}</span>
      </div>
      <Field label="Tiêu đề widget" hint="Dùng làm mô tả cho người đọc màn hình.">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Button variant="primary" disabled={!file || !title.trim() || busy} onClick={() => void upload()}>
        {busy ? 'Đang tải…' : 'Tải lên và chèn'}
      </Button>
      <details className="text-sm">
        <summary className="cursor-pointer text-accent">Prompt mẫu để nhờ AI sinh widget</summary>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-surface-note p-2 text-xs">{AI_PROMPT}</pre>
        <Button className="mt-2" onClick={() => void navigator.clipboard.writeText(AI_PROMPT).then(() => notify('Đã chép prompt'))}>Chép prompt</Button>
      </details>
    </section>
  );
}
