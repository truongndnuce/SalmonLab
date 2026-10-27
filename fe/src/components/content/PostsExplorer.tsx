'use client';

import { useMemo, useState } from 'react';
import { yearOf } from '@/lib/format';
import type { PostSummary } from '@/lib/types';
import { PostRow } from './PostRow';
import { SegmentedPill } from './SegmentedPill';

/**
 * Posts grouped by year with a category filter. Filtering happens client-side over the full list so
 * /posts stays a static, cacheable page (the unfiltered list is what search engines see).
 */
export function PostsExplorer({ posts, categories }: { posts: PostSummary[]; categories: { slug: string; name: string }[] }) {
  const [category, setCategory] = useState('all');

  const groups = useMemo(() => {
    const byYear = new Map<number, PostSummary[]>();
    for (const p of posts) {
      if (category !== 'all' && p.category?.slug !== category) continue;
      const y = yearOf(p.publishedAt);
      byYear.set(y, [...(byYear.get(y) ?? []), p]);
    }
    return [...byYear].sort((a, b) => b[0] - a[0]);
  }, [posts, category]);

  return (
    <>
      <div className="mb-8 flex justify-center">
        <SegmentedPill
          label="Lọc theo danh mục"
          onSelect={setCategory}
          items={[{ key: 'all', label: 'Tất cả', active: category === 'all' }, ...categories.map((c) => ({ key: c.slug, label: c.name, active: category === c.slug }))]}
        />
      </div>
      {groups.length === 0 && <p className="text-center text-muted">Chưa có bài viết nào.</p>}
      {groups.map(([year, items]) => (
        <section key={year} className="mb-8">
          <h2 className="mb-4 text-center text-xl font-bold">{year}</h2>
          <ul className="space-y-3">
            {items.map((p) => (
              <PostRow key={p.id} href={`/posts/${p.slug}`} title={p.title} publishedAt={p.publishedAt} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
