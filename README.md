# Salmon Lab

Blog cá nhân bằng tiếng Việt: ghi chép về lập trình, hệ thống phân tán, điện toán đám mây, AI và học máy. Giao diện và cấu trúc bám theo [fromcodetocloud.info](https://fromcodetocloud.info/).

- **Frontend** `fe/`: Next.js 15 (App Router), React 19, Tailwind CSS v4
- **Backend** `be/`: NestJS 10, Prisma 6, PostgreSQL 16
- **Monorepo**: pnpm workspaces + Turborepo (`packages/shared`: schema/type dùng chung)

Thiết kế chi tiết, quyết định kiến trúc và lộ trình nằm ở [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Trạng thái

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Khởi tạo monorepo, scaffold, Docker dev | ✅ |
| 1 | Lõi nội dung: API public + admin, auth, blog public đọc được, SEO/RSS, revalidate | ✅ |
| 2 | Admin UI (soạn bài, ghi chú, series, danh mục/thẻ, trang About) | ✅ |
| 2b | Upload ảnh/media (thư viện, MediaPicker, dán ảnh), import `.md`/`.zip` | ✅ |
| 3 | Infographic + widget tương tác (iframe sandbox), series | ✅ |
| 4–5 | Bảo mật (helmet, CSP, khoá tài khoản), tìm kiếm không dấu, OG động, dark mode, redirect slug, cài đặt site, import Hugo | ✅ |
| 6 | Triển khai (Docker, nginx, backup, CI/CD): đã viết, **chưa chạy thật** — xem [`docs/DEPLOY.md`](docs/DEPLOY.md) | 🟡 |

Nội dung được quản lý ở **http://localhost:3000/admin** (đăng nhập bằng tài khoản seed bên dưới), hoặc trực tiếp qua REST API (`/api/v1/admin/*`, xem Swagger). Ảnh tải lên được lưu ở kho S3 (RustFS khi dev, Cloudflare R2 khi deploy).

## Yêu cầu

- Node.js **≥ 22.12** (xem `.nvmrc`)
- pnpm **10** (`corepack enable`)
- Docker (Postgres, kho S3 cục bộ RustFS)

## Chạy ở máy local

```bash
# 1. Cài dependency
pnpm install

# 2. Hạ tầng: Postgres + kho S3 (RustFS)
docker compose -f infra/docker-compose.yml up -d

# 3. Biến môi trường
cp be/.env.example be/.env
cp fe/.env.example fe/.env.local

# 4. Database: migration + dữ liệu mẫu
pnpm --filter @salmon/be db:migrate
pnpm --filter @salmon/be db:seed

# 5. Chạy cả hai app
pnpm dev
```

| Dịch vụ | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Admin | http://localhost:3000/admin |
| Swagger | http://localhost:4000/api/docs |
| Kho S3 (RustFS) | API http://localhost:9000, console http://localhost:9001 (`salmon` / `salmon-secret`) |

Tài khoản admin từ seed: `admin@salmonlab.local` / `ChangeMe123!` (đổi bằng `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` khi chạy seed). Đổi các `*_SECRET` trong `be/.env` trước khi deploy; `REVALIDATE_SECRET` phải giống nhau ở `be/.env` và `fe/.env.local`.

### Thử đăng bài qua API

Nếu không dùng giao diện admin, có thể gọi API trực tiếp:

```bash
API=http://localhost:4000/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@salmonlab.local","password":"ChangeMe123!"}' | jq -r .data.accessToken)

# Tạo bản nháp rồi publish
ID=$(curl -s -X POST $API/admin/posts -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Bài đầu tiên","bodyMd":"## Xin chào\n\nNội dung."}' | jq -r .data.id)
curl -s -X POST $API/admin/posts/$ID/publish -H "Authorization: Bearer $TOKEN"
```

Sau khi publish, API gọi `POST /api/revalidate` của web nên trang công khai cập nhật trong vài giây.

## Lệnh thường dùng

Chạy từ thư mục gốc:

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy `be` (watch) và `fe` (dev) |
| `pnpm build` | Build tất cả. **`fe` cần API đang chạy** vì các trang tĩnh lấy dữ liệu lúc build |
| `pnpm lint` · `pnpm typecheck` | Kiểm tra mã. Lưu ý: `lint` của `be` có `--fix`, có thể tự sửa file |
| `pnpm test` | Unit test: Jest (`be`), Vitest (`fe`) |
| `pnpm --filter @salmon/be test:e2e` | E2E supertest trên DB riêng `salmon_test` (tự tạo + migrate; cần Postgres chạy) |
| `pnpm --filter @salmon/fe test:e2e` | Playwright (trang public + luồng admin); cần API + web đang chạy và đã seed (admin test dùng tài khoản seed, đặt `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` nếu đã đổi). Lần đầu: `pnpm --filter @salmon/fe exec playwright install chromium`. Các test đăng nhập nhiều lần nên chạy API với `LOGIN_RATE_LIMIT=100` (mặc định chỉ 5 lần/phút) |
| `pnpm --filter @salmon/be db:migrate` | Tạo/áp dụng migration (Prisma) |
| `pnpm --filter @salmon/be db:seed` | Nạp dữ liệu mẫu (chạy lại được) |
| `pnpm --filter @salmon/be import:hugo -- <content-dir> --email … --password … [--publish] [--dry-run]` | Nhập nội dung Hugo (TOML/YAML, bundle có ảnh) qua API; mặc định tạo bản nháp, giữ slug và ngày gốc |

## Cấu trúc

```
fe/                 Next.js: trang public, RSS, sitemap, /api/revalidate, khu quản trị /admin (src/admin/)
be/                 NestJS: API public + admin, auth, revalidate; prisma/ (schema, migrations, seed)
packages/shared/    enum + zod schema dùng chung (@salmon/shared)
packages/config/    tsconfig dùng chung
infra/              docker-compose dev + prod, nginx, script backup
.github/workflows/  CI (lint/test/build/e2e) và deploy
docs/               ARCHITECTURE.md
```

Cây thư mục đầy đủ và trạng thái từng phần nằm ở mục 4 của `docs/ARCHITECTURE.md`.

## Cách hoạt động (tóm tắt)

- Trang công khai được dựng tĩnh/ISR từ API và cache theo tag; người đọc không phụ thuộc tốc độ API.
- Khi admin publish/sửa/xoá, API phát sự kiện → `RevalidateService` gửi các tag cần làm mới sang `fe`.
- Chỉ nội dung `PUBLISHED` có `publishedAt <= now` mới hiện công khai; bài hẹn giờ được làm mới cache trong vòng ~1 phút nhờ job định kỳ.
- Không có đăng ký email; người đọc theo dõi qua RSS (`/rss.xml`).

## Giấy phép

Xem [LICENSE](LICENSE).
