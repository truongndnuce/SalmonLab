import { PrismaClient } from '@prisma/client';
import { slugifyVi } from './utils/slug';

/** Finds or creates tags by display name (slug derived from the name) and returns their ids. */
export async function upsertTagIds(
  prisma: PrismaClient,
  names: string[],
): Promise<string[]> {
  const bySlug = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    const slug = slugifyVi(name);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, name);
  }
  const ids: string[] = [];
  for (const [slug, name] of bySlug) {
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { slug, name },
    });
    ids.push(tag.id);
  }
  return ids;
}
