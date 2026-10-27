import { PostEditor } from '@/admin/components/PostEditor';

export const metadata = { title: 'Sửa bài viết' };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostEditor key={id} id={id} />;
}
