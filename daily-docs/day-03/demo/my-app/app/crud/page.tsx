import { CrudPost, CrudUser, RowActions } from "@/components/crud";
import { getPosts, getUsers } from "@/db/queries/select";
import { SelectPost, SelectUser } from "@/db/schema";
function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-sm text-zinc-900 dark:text-zinc-100 break-words">
        {children}
      </span>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        共 {count} 条
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {text}
    </div>
  );
}

const UserList = ({ users }: { users: SelectUser[] }) => {
  return (
    <section className="space-y-3">
      <SectionHeader title="User List" count={users.length} />
      {users.length === 0 ? (
        <EmptyState text="还没有 user，下方表单可以创建。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <article
              key={user.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {user.userName}
                </h3>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  #{user.id}
                </span>
              </header>
              <div className="space-y-2">
                <Field label="email">
                  <span className="font-mono text-xs">{user.email}</span>
                </Field>
                <Field label="password">
                  <span className="font-mono text-xs tracking-widest text-zinc-400">
                    {"•".repeat(8)}
                  </span>
                </Field>
                <Field label="created at">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {formatDate(user.createdAt)}
                  </span>
                </Field>
                {user.updatedAt && (
                  <Field label="updated at">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      {formatDate(user.updatedAt)}
                    </span>
                  </Field>
                )}
              </div>
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <RowActions kind="user" id={user.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

const PostList = ({ posts }: { posts: SelectPost[] }) => {
  return (
    <section className="space-y-3">
      <SectionHeader title="Post List" count={posts.length} />
      {posts.length === 0 ? (
        <EmptyState text="还没有 post，下方表单可以创建。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                  {post.title}
                </h3>
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  #{post.id}
                </span>
              </header>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {post.content}
              </p>

              <footer className="flex items-center justify-between border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <span>
                  by{" "}
                  {post.userId !== null && post.userId !== undefined ? (
                    <span className="font-mono">user #{post.userId}</span>
                  ) : (
                    <span className="italic text-zinc-400">unknown</span>
                  )}
                </span>
                <time>{formatDate(post.createdAt)}</time>
              </footer>
              <RowActions kind="post" id={post.id} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default async function CrudPage() {
  const [userList, postList] = await Promise.all([getUsers(), getPosts()]);
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          CRUD Demo
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          users / posts 的列表展示 + 创建表单
        </p>
      </header>

      <UserList users={userList} />
      <PostList posts={postList} />

      <section className="space-y-3">
        <SectionHeader title="操作" count={2} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CrudUser />
          <CrudPost
            users={userList.map((u) => ({
              id: u.id,
              userName: u.userName,
            }))}
          />
        </div>
      </section>
    </main>
  );
}