import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-[32px] font-bold">Không tìm thấy trang</h1>
      <p className="mt-2 text-muted">Trang bạn tìm không tồn tại hoặc đã được chuyển đi.</p>
      <Link href="/" className="mt-6 inline-block text-accent hover:text-accent-hover">
        ← Về trang chủ
      </Link>
    </div>
  );
}
