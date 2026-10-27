'use client';

import { useRouter } from 'next/navigation';

interface ArchiveYear {
  year: number;
  months: number[];
}

/** Year/month dropdowns; the selection lives in the URL (?year=&month=) so filtered pages are linkable. */
export function NoteFilter({ archive, year, month }: { archive: ArchiveYear[]; year?: number; month?: number }) {
  const router = useRouter();
  const go = (y?: number, m?: number) => {
    const qs = new URLSearchParams();
    if (y) qs.set('year', String(y));
    if (y && m) qs.set('month', String(m));
    router.push(qs.size ? `/notes?${qs}` : '/notes');
  };
  const months = archive.find((a) => a.year === year)?.months ?? [];
  const selectCls = 'rounded-full border border-border bg-surface-note px-3 py-1 text-sm';

  return (
    <div className="flex gap-3">
      <select aria-label="Năm" className={selectCls} value={year ?? ''} onChange={(e) => go(e.target.value ? Number(e.target.value) : undefined)}>
        <option value="">Mọi năm</option>
        {archive.map((a) => (
          <option key={a.year} value={a.year}>
            {a.year}
          </option>
        ))}
      </select>
      <select
        aria-label="Tháng"
        className={selectCls}
        value={month ?? ''}
        disabled={!year}
        onChange={(e) => go(year, e.target.value ? Number(e.target.value) : undefined)}
      >
        <option value="">Mọi tháng</option>
        {months.map((m) => (
          <option key={m} value={m}>
            Tháng {m}
          </option>
        ))}
      </select>
    </div>
  );
}
