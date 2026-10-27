import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  WEB_REVALIDATE_URL: z
    .string()
    .url()
    .default('http://localhost:3000/api/revalidate'),
  REVALIDATE_SECRET: z.string().min(1),
  SITE_NAME: z.string().default('Salmon Lab'),
  SITE_TAGLINE: z
    .string()
    .default(
      'Những ghi chép về lập trình máy tính, các hệ thống phân tán và điện toán đám mây, AI và học máy',
    ),
  SITE_COVER_URL: z.string().optional(),

  // Object storage: S3 API. Dev points at the local container; in prod set R2_ACCOUNT_ID (endpoint is derived).
  R2_ACCOUNT_ID: z.string().optional(),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  R2_ACCESS_KEY_ID: z.string().default('salmon'),
  R2_SECRET_ACCESS_KEY: z.string().default('salmon-secret'),
  R2_BUCKET_MEDIA: z.string().default('blog-media'),
  R2_BUCKET_WIDGETS: z.string().default('blog-widgets'),
  R2_BUCKET_PRIVATE: z.string().default('blog-private'),
  R2_PUBLIC_MEDIA_URL: z
    .string()
    .url()
    .default('http://localhost:9000/blog-media'),
  R2_PUBLIC_WIDGETS_URL: z
    .string()
    .url()
    .default('http://localhost:9000/blog-widgets'),
});
export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
