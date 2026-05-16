import Link from "next/link";
import { notFound } from "next/navigation";

import { UpdateUser } from "@/components/crud";
import { getUserById } from "@/db/queries/select";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    notFound();
  }

  const user = await getUserById(userId);
  if (!user) {
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
          编辑 User
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          user #{user.id} · 修改 userName / email / password
        </p>
      </header>

      <UpdateUser
        user={{
          id: user.id,
          userName: user.userName,
          email: user.email,
        }}
      />
    </main>
  );
}
