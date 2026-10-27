import { dateRange, meta, paginate, publicWhere } from './public';

describe('publicWhere', () => {
  it('only matches published content up to now', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(publicWhere(now)).toEqual({
      status: 'PUBLISHED',
      publishedAt: { lte: now },
    });
  });
});

describe('dateRange', () => {
  it('covers a month in UTC+7', () => {
    const r = dateRange(2026, 10);
    expect(r.gte).toEqual(new Date('2026-09-30T17:00:00Z'));
    expect(r.lt).toEqual(new Date('2026-10-31T17:00:00Z'));
  });
  it('rolls over December and whole years', () => {
    expect(dateRange(2026, 12).lt).toEqual(new Date('2026-12-31T17:00:00Z'));
    expect(dateRange(2026).lt).toEqual(new Date('2026-12-31T17:00:00Z'));
  });
});

describe('paginate/meta', () => {
  it('computes skip/take', () => {
    expect(paginate(3, 20)).toEqual({ skip: 40, take: 20 });
    expect(meta(1, 20, 5)).toEqual({ page: 1, pageSize: 20, total: 5 });
  });
});
