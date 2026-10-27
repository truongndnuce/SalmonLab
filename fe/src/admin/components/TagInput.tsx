'use client';

import { useId, useState } from 'react';
import { inputCls } from './ui';

/** Free-form tags (created on save by name) with suggestions from existing ones. */
export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState('');
  const listId = useId();

  const add = (raw: string) => {
    const name = raw.trim();
    if (name && !value.some((t) => t.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft('');
  };

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-note px-2.5 py-0.5 text-sm">
              {t}
              <button type="button" aria-label={`Bỏ thẻ ${t}`} className="text-muted hover:text-danger" onClick={() => onChange(value.filter((x) => x !== t))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className={inputCls}
        list={listId}
        value={draft}
        placeholder="Nhập thẻ rồi nhấn Enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
