'use client';

import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, getAccessToken, uploadImage } from '../lib/api';
import type { AdminMedia } from '../lib/types';
import { WidgetRuntime } from '@/components/content/WidgetRuntime';
import MediaPicker from './MediaPicker';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Minimum height of the editing/preview panes. */
  minHeight?: string;
}

type View = 'split' | 'write' | 'preview';

/** CodeMirror editor next to a live preview rendered by the same pipeline as the public site. */
export default function MarkdownEditor({ value, onChange, minHeight = '480px' }: Props) {
  const [view, setView] = useState<View>('split');
  const [html, setHtml] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [picker, setPicker] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const insertImage = useCallback((m: AdminMedia) => {
    const v = viewRef.current;
    const text = `![${m.alt ?? ''}](${m.url})`;
    if (!v) return;
    const { from, to } = v.state.selection.main;
    v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    v.focus();
  }, []);

  const uploadAndInsert = useCallback(
    async (files: File[]) => {
      for (const f of files) {
        setUploadNote(`Đang tải lên ${f.name || 'ảnh'}…`);
        try {
          insertImage((await uploadImage(f)).data);
          setUploadNote(null);
        } catch (e) {
          setUploadNote(`Không tải được ảnh: ${errorMessage(e)}`);
          return;
        }
      }
    },
    [insertImage],
  );

  // Paste or drop image files into the editor to upload them and insert the Markdown at the cursor.
  const upload = useRef(uploadAndInsert);
  upload.current = uploadAndInsert;
  const extensions = useMemo(
    () => [
      markdown({ codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        paste(e) {
          const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          e.preventDefault();
          void upload.current(files);
          return true;
        },
        drop(e) {
          const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          e.preventDefault();
          void upload.current(files);
          return true;
        },
      }),
    ],
    [],
  );

  useEffect(() => {
    if (view === 'write') return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/preview', {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${getAccessToken() ?? ''}` },
          body: JSON.stringify({ md: value }),
        });
        if (!res.ok) throw new Error(res.status === 401 ? 'Phiên đăng nhập hết hạn' : `Không xem trước được (${res.status})`);
        setHtml((await res.json()).html);
        setPreviewError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setPreviewError((e as Error).message);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, view]);

  const tab = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`rounded-md px-3 py-1 text-sm ${view === v ? 'bg-bg font-semibold text-accent shadow-sm' : 'text-muted hover:text-fg'}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-2 inline-flex gap-1 rounded-lg border border-border bg-surface-note p-0.5" role="group" aria-label="Chế độ soạn thảo">
        {tab('split', 'Song song')}
        {tab('write', 'Viết')}
        {tab('preview', 'Xem trước')}
      </div>
      {view !== 'preview' && (
        <button type="button" onClick={() => setPicker(true)} className="ml-3 rounded-md border border-border px-3 py-1 text-sm hover:border-accent hover:text-accent">
          Chèn ảnh
        </button>
      )}
      {uploadNote && <p className="mb-2 text-sm text-muted" role="status">{uploadNote}</p>}
      {picker && (
        <MediaPicker
          onClose={() => setPicker(false)}
          onSelect={(m) => {
            setPicker(false);
            insertImage(m);
          }}
        />
      )}
      <div className={`grid gap-4 ${view === 'split' ? 'lg:grid-cols-2' : ''}`}>
        {view !== 'preview' && (
          <div className="min-w-0 overflow-hidden rounded-md border border-border" style={{ minHeight }}>
            <CodeMirror
              value={value}
              onChange={onChange}
              onCreateEditor={(v) => {
                viewRef.current = v;
              }}
              extensions={extensions}
              minHeight={minHeight}
              basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
              aria-label="Nội dung Markdown"
            />
          </div>
        )}
        {view !== 'write' && (
          <div className="min-w-0 overflow-auto rounded-md border border-border p-5" style={{ minHeight }}>
            {previewError && <p className="mb-3 text-sm text-danger">{previewError}</p>}
            {value.trim() === '' ? (
              <p className="text-muted">Chưa có nội dung.</p>
            ) : (
              <>
                <div className="prose prose-salmon max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
                <WidgetRuntime observe />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
