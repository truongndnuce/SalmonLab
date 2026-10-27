import { randomBytes } from 'node:crypto';

/** Vietnamese-aware kebab-case slug: strips diacritics, maps đ -> d. */
export function slugifyVi(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Appends -2, -3, ... until `exists` returns false. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base;
  for (let n = 2; await exists(slug); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Note slug: yyyyMMddHHmmss (Asia/Ho_Chi_Minh) + '-' + 4 hex chars. */
export function noteSlug(
  date: Date = new Date(),
  suffix: string = randomBytes(2).toString('hex'),
): string {
  const stamp = new Date(date.getTime() + VN_OFFSET_MS)
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14);
  return `${stamp}-${suffix}`;
}
