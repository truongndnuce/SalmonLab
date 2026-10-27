import { z } from 'zod';

export const ContentStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const PostKind = z.enum(['POST', 'INFOGRAPHIC']);
export type PostKind = z.infer<typeof PostKind>;

export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const TagSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

export const SeriesSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  featured: z.boolean(),
  featuredOrder: z.number().int().nullable(),
});
export type Series = z.infer<typeof SeriesSchema>;

export const PostSchema = z.object({
  id: z.string(),
  kind: PostKind,
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  bodyMd: z.string(),
  coverUrl: z.string().nullable(),
  coverAlt: z.string().nullable(),
  status: ContentStatus,
  publishedAt: z.string().datetime().nullable(),
  wordCount: z.number().int(),
  readingMins: z.number().int(),
  featured: z.boolean(),
  category: CategorySchema.nullable(),
  tags: z.array(TagSchema),
  series: SeriesSchema.nullable(),
  seriesOrder: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Post = z.infer<typeof PostSchema>;

export const NoteSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().nullable(),
  bodyMd: z.string(),
  status: ContentStatus,
  publishedAt: z.string().datetime().nullable(),
  category: CategorySchema.nullable(),
  tags: z.array(TagSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Note = z.infer<typeof NoteSchema>;

export const PageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  bodyMd: z.string(),
  updatedAt: z.string().datetime(),
});
export type Page = z.infer<typeof PageSchema>;

export const MetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type Meta = z.infer<typeof MetaSchema>;

export interface ApiResponse<T> {
  data: T;
  meta?: Meta;
}

export interface ApiError {
  error: { code: string; message: string };
}
