# Triển khai Salmon Lab

Hướng dẫn đưa blog lên một VPS (Docker Compose) với Cloudflare R2 làm kho ảnh/widget. Các file liên quan: `infra/docker-compose.prod.yml`, `infra/nginx/`, `infra/backup/`, `.github/workflows/`.

> Các bước dưới đây **chưa được chạy thật** trên VPS/GitHub (chỉ kiểm tra cú pháp và build image ở máy dev). Hãy làm lần đầu cẩn thận và xem log.

## 1. Cloudflare R2 (làm một lần)

1. Tạo 2 bucket: `blog-media` và `blog-widgets` (bucket `blog-private` chỉ cần khi có file riêng tư).
2. **Domain công khai**: gắn custom domain cho từng bucket, ví dụ `media.example.com` → `blog-media`, `static.example.com` → `blog-widgets` (Bucket → Settings → Custom Domains). Không dùng domain `r2.dev` cho production.
3. **API token** (R2 → Manage API Tokens): quyền *Object Read & Write* giới hạn trong hai bucket trên. Lấy `Account ID`, `Access Key ID`, `Secret Access Key`.
4. **Domain tĩnh của widget** (`static.example.com`) phải khác domain chính. Thêm *Transform Rule → Modify Response Header* cho domain này:
   - `Content-Security-Policy`: `default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors https://example.com`
   - `X-Content-Type-Options`: `nosniff`

   (API đã tiêm một CSP tương tự vào từng file widget bằng thẻ `<meta>`; header này bổ sung `frame-ancestors`, chỉ cho phép site của bạn nhúng.)
5. Không bật CORS cho bucket nếu không cần: trang web chỉ nhúng ảnh/iframe, không `fetch` file từ bucket.

## 2. Server

Cần Docker + Docker Compose, cổng 80/443 mở, và hai bản ghi DNS (`example.com`, `api.example.com`) trỏ về server.

```bash
git clone <repo> /opt/salmon && cd /opt/salmon
cp infra/.env.prod.example infra/.env.prod   # điền đủ các giá trị; tạo secret bằng: openssl rand -hex 32
```

Chứng chỉ TLS: đặt `fullchain.pem` và `privkey.pem` vào volume `certs` (ví dụ chứng chỉ origin của Cloudflare, hoặc certbot). Nginx đọc từ `/etc/nginx/certs`.

## 3. Chạy lần đầu

```bash
C="docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod"
$C up -d --build postgres api     # API tự chạy `prisma migrate deploy` khi khởi động
$C build web                      # build web CẦN API đang chạy (prerender từ API, dùng network: host)
$C up -d web nginx backup
```

Tạo tài khoản admin lần đầu bằng seed (đổi mật khẩu ngay sau đó):

```bash
$C run --rm -e SEED_ADMIN_EMAIL=you@example.com -e SEED_ADMIN_PASSWORD='mật-khẩu-mạnh' api npx prisma db seed
```

> Seed cũng nạp bài/ghi chú mẫu. Xoá chúng ở `/admin` nếu không cần.

Kiểm tra: `https://example.com`, `https://api.example.com/api/v1/health`, đăng nhập `https://example.com/admin`.

## 4. Cập nhật (CI/CD)

`.github/workflows/ci.yml` chạy lint, typecheck, unit test, e2e backend, build và Playwright trên mỗi PR/push. `deploy.yml` chạy sau khi CI xanh trên `main`, SSH vào server và thực hiện các lệnh ở mục 3 (API trước, rồi build/đổi web). Cần secret `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` (tạo *environment* `production` để có thể yêu cầu duyệt tay).

Web mới khởi động với cache rỗng nên không cần gọi revalidate sau deploy; nếu cần làm mới thủ công: admin → Tổng quan → "Làm mới toàn bộ".

## 5. Backup & khôi phục

Service `backup` chạy `pg_dump` mỗi 24 giờ vào `BACKUP_DIR` (mặc định `infra/backups`), giữ `BACKUP_KEEP_DAYS` ngày (14). **Hãy sao chép thư mục này ra ngoài server** (rclone/rsync sang R2 hoặc máy khác); backup trên cùng đĩa không cứu được khi mất server. Ảnh/widget nằm ở R2 nên không nằm trong dump.

Khôi phục:

```bash
gunzip -c backups/salmon-YYYYmmdd-HHMMSS.sql.gz | $C exec -T postgres psql -U salmon salmon
```

Hãy thử khôi phục vào một database trống định kỳ để chắc chắn backup dùng được.

## 6. Giám sát

- Đặt `SENTRY_DSN` trong `infra/.env.prod` để API báo lỗi 5xx lên Sentry (web chưa tích hợp).
- Health check: `GET /api/v1/health` (có kiểm tra database); Docker dùng nó cho `HEALTHCHECK`.
- Đo Lighthouse (mobile) trên bản deploy; mục tiêu ≥ 90 ở trang bài viết.

## 7. Lưu ý bảo mật

- `/api/revalidate` bị nginx chặn từ ngoài (chỉ API gọi nội bộ qua mạng Docker), vẫn cần `REVALIDATE_SECRET` mạnh.
- Cookie refresh có `Secure` khi chạy `NODE_ENV=production` qua HTTPS; admin và API phải cùng site (cùng domain gốc) để SameSite=Lax hoạt động.
- Đổi mật khẩu admin mặc định của seed, không commit `infra/.env.prod`.
