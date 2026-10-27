import { Prisma } from '@prisma/client';

/** Only PUBLISHED content whose publish time has passed is visible publicly (supports scheduling). */
export const publicWhere = (now: Date = new Date()) =>
  ({ status: 'PUBLISHED', publishedAt: { lte: now } }) as const;

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export const meta = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
});

/** Calendar bounds in Asia/Ho_Chi_Minh (UTC+7), matching how dates are displayed on the site. */
export function dateRange(year: number, month?: number): Prisma.DateTimeFilter {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = new Date(`${year}-${pad(month ?? 1)}-01T00:00:00+07:00`);
  const end = month
    ? new Date(
        `${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01T00:00:00+07:00`,
      )
    : new Date(`${year + 1}-01-01T00:00:00+07:00`);
  return { gte: start, lt: end };
}
