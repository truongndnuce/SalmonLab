import Link from 'next/link';

export function SectionHeading({ title, href, linkLabel = 'Xem tất cả →' }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="text-[22px] font-bold">{title}</h2>
      {href && (
        <Link href={href} className="text-sm text-accent hover:text-accent-hover">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
