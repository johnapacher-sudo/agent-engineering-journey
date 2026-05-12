import Link from "next/link";
import { notFound } from "next/navigation";

import { UpdatePost } from "@/components/crud";
import { getPostById, getUsers } from "@/db/queries/select";

type EditPostPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    notFound();
  }

  const [post, users] = await Promise.all([getPostById(postId), getUsers()]);
  if (!post) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <header className="space-y-1">
        <Link
          href="/crud"
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← 返回 CRUD 列表
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          编辑 Post
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          post #{post.id} · 修改 title / content / author
        </p>
      </header>

      <UpdatePost
        post={{
          id: post.id,
          title: post.title,
          content: post.content,
          userId: post.userId,
        }}
        users={users.map((u) => ({ id: u.id, userName: u.userName }))}
      />
    </main>
  );
}
