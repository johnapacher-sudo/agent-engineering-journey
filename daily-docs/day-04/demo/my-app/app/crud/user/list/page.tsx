import React from 'react';
import { getUserList, getUsersInfo } from './action';
import { IPostsAndTagsRequest, getPosts, getTags, getUsers } from '@/db/queries/select';
import { FilterBar } from './_components/FilterBar';
import { Pagination } from './_components/Pagination';
import Button from './_components/NextButton'

interface ISearchParams extends IPostsAndTagsRequest {}

interface IUserListPageProps {
  searchParams: Promise<ISearchParams>;
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const STATUS_STYLES: Record<string, string> = {
  published:
    'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  draft:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  archived:
    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.archived;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${cls}`}
    >
      {status}
    </span>
  );
}

function FilterPills({
  userId,
  postId,
  postTagId,
  postTagName,
  postStatus,
}: ISearchParams) {
  const items: Array<{ key: string; label: string }> = [];
  if (userId !== undefined) items.push({ key: 'userId', label: `userId = ${userId}` });
  if (postId !== undefined) items.push({ key: 'postId', label: `postId = ${postId}` });
  if (postTagId !== undefined) items.push({ key: 'postTagId', label: `postTagId = ${postTagId}` });
  if (postTagName) items.push({ key: 'postTagName', label: `tag = ${postTagName}` });
  if (postStatus) items.push({ key: 'postStatus', label: `status = ${postStatus}` });

  if (items.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        未启用筛选 · 在下方筛选条件中选择并点「应用筛选」
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">当前筛选:</span>
      {items.map((it) => (
        <span
          key={it.key}
          className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        >
          {it.label}
        </span>
      ))}
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

// searchParams 进来都是 string，需要把 numeric 字段转回 number 给 query 使用
function normalizeSearchParams(raw: ISearchParams): IPostsAndTagsRequest {
  const toNum = (v: unknown) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    userId: toNum(raw.userId),
    postId: toNum(raw.postId),
    postTagId: toNum(raw.postTagId),
    postTagName: typeof raw.postTagName === 'string' && raw.postTagName !== '' ? raw.postTagName : undefined,
    postStatus: raw.postStatus,
    limit: toNum(raw.limit),
    offset: toNum(raw.offset),
    cursor: toNum(raw.cursor),
  };
}

export default async function UserListPage({ searchParams }: IUserListPageProps) {
  const rawParams = await searchParams;
  const normalized = normalizeSearchParams(rawParams);

  // 并发拉：列表 + 三个 select 的选项
  const [userInfo, allUsers, allPosts, allTags] = await Promise.all([
    getUsersInfo(normalized),
    getUsers(),
    getPosts(),
    getTags(),
  ]);
  const {
    users: userList,
    total,
    pageIndex,
    pageSize,
    hasNextPage,
    hasPreviousPage,
    totalPages,
    cursorIndex,
  } = userInfo;
  
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <header className="space-y-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            User List
          </h1>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            共 {total} 位 user · 当前页 {userList.length} 条
          </span>
        </div>
        <FilterPills {...normalized} />
      </header>

      <FilterBar
        initial={normalized}
        users={allUsers.map((u) => ({ id: u.id, label: u.userName }))}
        posts={allPosts.map((p) => ({ id: p.id, label: p.title }))}
        tags={allTags.map((t) => ({ id: t.id, name: t.name }))}
      />

      {userList.length === 0 ? (
        <EmptyState text="没有匹配的 user。试试调整筛选条件。" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {userList.map((user) => (
            <article
              key={user.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {user.userName}
                  </h2>
                  <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  #{user.id}
                </span>
              </header>

              <section>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Posts
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {user.posts.length} 条
                  </span>
                </div>

                {user.posts.length === 0 ? (
                  <p className="rounded border border-dashed border-zinc-200 px-2 py-3 text-center text-xs text-zinc-400 dark:border-zinc-800">
                    无符合条件的 post
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {user.posts.map((post) => (
                      <li
                        key={post.id}
                        className="rounded border border-zinc-100 bg-zinc-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-medium leading-tight text-zinc-900 dark:text-zinc-100">
                            {post.title}
                          </h4>
                          <StatusBadge status={post.status} />
                        </div>

                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {post.content}
                        </p>

                        {post.tagsGroup.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-1">
                            {post.tagsGroup.map((tagItem) => (
                              <li
                                key={tagItem.tagId}
                                className="rounded-full bg-zinc-200/70 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              >
                                #{tagItem.tag.name}
                              </li>
                            ))}
                          </ul>
                        )}

                        <footer className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                          <time>created {formatDate(post.createdAt)}</time>
                          {post.updatedAt && (
                            <time>updated {formatDate(post.updatedAt)}</time>
                          )}
                        </footer>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </article>
          ))}
        </div>
      )}

      {total > 0 && (
        <Pagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalPages={totalPages}
          total={total}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      )}  
      {total > 0 && cursorIndex !== null && <Button cursorIndex={cursorIndex} />}
    </main>
  );
}
