import { PostEditor } from '@/admin/components/PostEditor';

export const metadata = { title: 'Bài viết mới' };

export default function NewPostPage() {
  return <PostEditor id="new" />;
}
