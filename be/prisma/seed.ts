import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { noteSlug, slugifyVi } from '../src/common/utils/slug';
import { readingStats } from '../src/common/utils/reading-stats';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@salmonlab.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

const samplePosts = [
  { title: 'Xây dựng hệ thống quản trị cá nhân dưới 1$/tháng', category: 'khcn', tags: ['tản mạn', 'aws'], date: '2026-09-05', featured: true },
  { title: 'Lời gọi hàm khi phải đi qua mạng', category: 'khcn', tags: ['hệ thống phân tán'], date: '2026-08-20', series: 1 },
  { title: 'Request-response và những điều cần biết', category: 'khcn', tags: ['hệ thống phân tán'], date: '2026-08-27', series: 2 },
  { title: 'Một buổi chiều đọc sách', category: 'khac', tags: ['tản mạn'], date: '2025-12-12' },
  { title: 'Đo lường trước khi tối ưu', category: 'khcn', tags: ['hiệu năng'], date: '2025-06-01' },
];

const sampleNotes = [
  { body: 'Hôm nay thử chuyển cache sang revalidate theo tag, nhanh hơn hẳn. 🎉', date: '2026-10-14T09:29:46Z' },
  { body: 'Ghi chú nhanh: `EXPLAIN ANALYZE` luôn đáng chạy trước khi thêm index.', date: '2026-10-10T03:15:00Z' },
  { body: 'Đọc lại chương về nhất quán cuối cùng (eventual consistency).\n\nVẫn thấy hay.', date: '2026-09-28T14:00:00Z' },
  { body: 'Một câu hỏi phỏng vấn hay: điều gì xảy ra khi bạn gõ URL vào trình duyệt?', date: '2026-08-02T01:20:00Z' },
  { body: 'Cà phê sáng + code = ổn.', date: '2025-11-20T02:00:00Z' },
];

function lorem(title: string): string {
  return `## Giới thiệu\n\nĐây là bài mẫu "${title}" dùng cho dữ liệu seed.\n\n## Nội dung\n\n${'Nội dung bài viết mẫu bằng tiếng Việt. '.repeat(40)}\n\n\`\`\`ts\nconst hello = 'salmon';\n\`\`\`\n`;
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: await argon2.hash(ADMIN_PASSWORD),
      displayName: 'Salmon',
    },
  });

  const categories = Object.fromEntries(
    await Promise.all(
      [
        ['khcn', 'KHCN'],
        ['khac', 'Khác'],
      ].map(async ([slug, name]) => [
        slug,
        await prisma.category.upsert({ where: { slug }, update: { name }, create: { slug, name } }),
      ]),
    ),
  );

  const series = await prisma.series.upsert({
    where: { slug: 'back-to-basics' },
    update: {},
    create: {
      slug: 'back-to-basics',
      title: 'Back To Basics',
      description: 'Ôn lại những nền tảng của hệ thống phân tán.',
      featured: true,
      featuredOrder: 1,
    },
  });

  for (const p of samplePosts) {
    const slug = slugifyVi(p.title);
    const bodyMd = lorem(p.title);
    const data = {
      title: p.title,
      excerpt: `Bài mẫu: ${p.title}`,
      bodyMd,
      ...readingStats(bodyMd),
      status: 'PUBLISHED' as const,
      publishedAt: new Date(`${p.date}T00:00:00+07:00`),
      featured: p.featured ?? false,
      authorId: admin.id,
      categoryId: categories[p.category].id,
      seriesId: p.series ? series.id : null,
      seriesOrder: p.series ?? null,
    };
    const post = await prisma.post.upsert({ where: { slug }, update: data, create: { slug, ...data } });
    for (const name of p.tags) {
      const tag = await prisma.tag.upsert({
        where: { slug: slugifyVi(name) },
        update: {},
        create: { slug: slugifyVi(name), name },
      });
      await prisma.postTag.upsert({
        where: { postId_tagId: { postId: post.id, tagId: tag.id } },
        update: {},
        create: { postId: post.id, tagId: tag.id },
      });
    }
  }

  // Notes get a random slug, so only seed them when none exist (keeps re-runs idempotent).
  if ((await prisma.note.count()) === 0) {
    for (const n of sampleNotes) {
      const publishedAt = new Date(n.date);
      await prisma.note.create({
        data: {
          slug: noteSlug(publishedAt),
          bodyMd: n.body,
          status: 'PUBLISHED',
          publishedAt,
          authorId: admin.id,
          categoryId: categories.khac.id,
        },
      });
    }
  }

  await prisma.page.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about',
      title: 'Giới thiệu',
      bodyMd: 'Salmon Lab là nơi ghi chép về lập trình, hệ thống phân tán, điện toán đám mây, AI và học máy.',
    },
  });

  console.log(`Seeded. Admin: ${ADMIN_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
