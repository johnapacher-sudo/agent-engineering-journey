import { db } from '@/db';
import {
  usersTable,
  postsTable,
  tagsTable,
  tipsTable,
  postsTagsTable,
} from '@/db/schema';
import {
  getUserById,
  getPostById,
  getTagById,
  getTipById,
  getPostsTagsByPostId,
  getPostsTagsByTagId,
  getPostsTagsByPostIdAndTagId,
  getUserWithPosts,
} from '@/db/queries/select';

import { UserCrud } from '@/components/UserCrud';

import {
  createPostAction,
  updatePostAction,
  deletePostAction,
  createTagAction,
  updateTagAction,
  deleteTagAction,
  createTipAction,
  updateTipAction,
  deleteTipAction,
  createPostsTagsAction,
  deletePostsTagsAction,
} from './actions';

export const dynamic = 'force-dynamic';

type SearchParamsObj = {
  userId?: string;
  postId?: string;
  tagId?: string;
  tipId?: string;
  ptPostId?: string;
  ptTagId?: string;
  uwpUserId?: string;
};

function toNum(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function Pre({ data }: { data: unknown }) {
  return (
    <pre className="overflow-x-auto rounded bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {hint ? (
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : (
        <div className="mb-4" />
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

const inputCls =
  'w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500';

const btnCls =
  'rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';

const btnDangerCls =
  'rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500';

function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  empty = '(无数据)',
}: {
  rows: T[];
  columns: { key: keyof T; label: string }[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{empty}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className="px-2 py-1 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900"
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className="px-2 py-1 text-zinc-800 dark:text-zinc-200"
                >
                  {String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsObj>;
}) {
  const sp = await searchParams;

  const [users, posts, tags, tips, postsTags] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(postsTable),
    db.select().from(tagsTable),
    db.select().from(tipsTable),
    db.select().from(postsTagsTable),
  ]);

  const userIdQ = toNum(sp.userId);
  const postIdQ = toNum(sp.postId);
  const tagIdQ = toNum(sp.tagId);
  const tipIdQ = toNum(sp.tipId);
  const ptPostIdQ = toNum(sp.ptPostId);
  const ptTagIdQ = toNum(sp.ptTagId);
  const uwpUserIdQ = toNum(sp.uwpUserId);

  const [
    userByIdRes,
    postByIdRes,
    tagByIdRes,
    tipByIdRes,
    ptByPostIdRes,
    ptByTagIdRes,
    ptByBothRes,
    userWithPostsRes,
  ] = await Promise.all([
    userIdQ !== undefined ? getUserById(userIdQ) : Promise.resolve(null),
    postIdQ !== undefined ? getPostById(postIdQ) : Promise.resolve(null),
    tagIdQ !== undefined ? getTagById(tagIdQ) : Promise.resolve(null),
    tipIdQ !== undefined ? getTipById(tipIdQ) : Promise.resolve(null),
    ptPostIdQ !== undefined
      ? getPostsTagsByPostId(ptPostIdQ)
      : Promise.resolve(null),
    ptTagIdQ !== undefined
      ? getPostsTagsByTagId(ptTagIdQ)
      : Promise.resolve(null),
    ptPostIdQ !== undefined && ptTagIdQ !== undefined
      ? getPostsTagsByPostIdAndTagId(ptPostIdQ, ptTagIdQ)
      : Promise.resolve(null),
    uwpUserIdQ !== undefined
      ? getUserWithPosts(uwpUserIdQ)
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Drizzle CRUD + Relations Demo
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          覆盖 <code>db/queries</code> 里的所有 select / insert / update /
          delete，以及通过 <code>relations</code> 的多级嵌套查询。
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          实体：<code>users → posts</code>、<code>users → tags → tips</code>、
          <code>posts ↔ tags</code>（通过 <code>posts_tags</code> 多对多）。
        </p>
      </header>

      <Section
        title="① 数据总览（list select）"
        hint="Server Component 直接调用 db.select().from(table) 拉取所有行。"
      >
        <SubCard title={`users (${users.length})`}>
          <DataTable
            rows={users}
            columns={[
              { key: 'id', label: 'id' },
              { key: 'name', label: 'name' },
              { key: 'age', label: 'age' },
              { key: 'email', label: 'email' },
            ]}
          />
        </SubCard>

        <SubCard title={`posts (${posts.length})`}>
          <DataTable
            rows={posts}
            columns={[
              { key: 'id', label: 'id' },
              { key: 'title', label: 'title' },
              { key: 'content', label: 'content' },
              { key: 'userId', label: 'userId (FK→users)' },
            ]}
          />
        </SubCard>

        <SubCard title={`tags (${tags.length})`}>
          <DataTable
            rows={tags}
            columns={[
              { key: 'id', label: 'id' },
              { key: 'content', label: 'content' },
              { key: 'userId', label: 'userId (FK→users)' },
            ]}
          />
        </SubCard>

        <SubCard title={`tips (${tips.length})`}>
          <DataTable
            rows={tips}
            columns={[
              { key: 'id', label: 'id' },
              { key: 'content', label: 'content' },
              { key: 'tagId', label: 'tagId (FK→tags)' },
            ]}
          />
        </SubCard>

        <SubCard title={`posts_tags (${postsTags.length}) — 连接表`}>
          <DataTable
            rows={postsTags}
            columns={[
              { key: 'postId', label: 'postId (PK + FK→posts)' },
              { key: 'tagId', label: 'tagId (PK + FK→tags)' },
            ]}
          />
        </SubCard>
      </Section>

      <Section
        title="② 按 ID 单条查询（getXxxById）"
        hint="表单用 GET 提交，把 id 拼到 URL，Server Component 拿到 searchParams 后调用 select query。"
      >
        <SubCard title="getUserById(id)">
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="postId" value={sp.postId ?? ''} />
            <input type="hidden" name="tagId" value={sp.tagId ?? ''} />
            <input type="hidden" name="tipId" value={sp.tipId ?? ''} />
            <input type="hidden" name="ptPostId" value={sp.ptPostId ?? ''} />
            <input type="hidden" name="ptTagId" value={sp.ptTagId ?? ''} />
            <input
              type="hidden"
              name="uwpUserId"
              value={sp.uwpUserId ?? ''}
            />
            <label className="text-xs text-zinc-500">
              userId
              <input
                name="userId"
                type="number"
                defaultValue={sp.userId ?? ''}
                placeholder="1"
                className={inputCls}
              />
            </label>
            <button type="submit" className={btnCls}>
              查询
            </button>
          </form>
          {userByIdRes !== null && <Pre data={userByIdRes} />}
        </SubCard>

        <SubCard title="getPostById(id)">
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={sp.userId ?? ''} />
            <input type="hidden" name="tagId" value={sp.tagId ?? ''} />
            <input type="hidden" name="tipId" value={sp.tipId ?? ''} />
            <input type="hidden" name="ptPostId" value={sp.ptPostId ?? ''} />
            <input type="hidden" name="ptTagId" value={sp.ptTagId ?? ''} />
            <input
              type="hidden"
              name="uwpUserId"
              value={sp.uwpUserId ?? ''}
            />
            <label className="text-xs text-zinc-500">
              postId
              <input
                name="postId"
                type="number"
                defaultValue={sp.postId ?? ''}
                placeholder="1"
                className={inputCls}
              />
            </label>
            <button type="submit" className={btnCls}>
              查询
            </button>
          </form>
          {postByIdRes !== null && <Pre data={postByIdRes} />}
        </SubCard>

        <SubCard title="getTagById(id)">
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={sp.userId ?? ''} />
            <input type="hidden" name="postId" value={sp.postId ?? ''} />
            <input type="hidden" name="tipId" value={sp.tipId ?? ''} />
            <input type="hidden" name="ptPostId" value={sp.ptPostId ?? ''} />
            <input type="hidden" name="ptTagId" value={sp.ptTagId ?? ''} />
            <input
              type="hidden"
              name="uwpUserId"
              value={sp.uwpUserId ?? ''}
            />
            <label className="text-xs text-zinc-500">
              tagId
              <input
                name="tagId"
                type="number"
                defaultValue={sp.tagId ?? ''}
                placeholder="1"
                className={inputCls}
              />
            </label>
            <button type="submit" className={btnCls}>
              查询
            </button>
          </form>
          {tagByIdRes !== null && <Pre data={tagByIdRes} />}
        </SubCard>

        <SubCard title="getTipById(id)">
          <form method="GET" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={sp.userId ?? ''} />
            <input type="hidden" name="postId" value={sp.postId ?? ''} />
            <input type="hidden" name="tagId" value={sp.tagId ?? ''} />
            <input type="hidden" name="ptPostId" value={sp.ptPostId ?? ''} />
            <input type="hidden" name="ptTagId" value={sp.ptTagId ?? ''} />
            <input
              type="hidden"
              name="uwpUserId"
              value={sp.uwpUserId ?? ''}
            />
            <label className="text-xs text-zinc-500">
              tipId
              <input
                name="tipId"
                type="number"
                defaultValue={sp.tipId ?? ''}
                placeholder="1"
                className={inputCls}
              />
            </label>
            <button type="submit" className={btnCls}>
              查询
            </button>
          </form>
          {tipByIdRes !== null && <Pre data={tipByIdRes} />}
        </SubCard>
      </Section>

      <Section
        title="③ 连接表的多种查询（getPostsTagsByXxx）"
        hint="同一个 form 同时填 postId / tagId，会展示三种 query：按 postId、按 tagId、以及组合主键查询。"
      >
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="userId" value={sp.userId ?? ''} />
          <input type="hidden" name="postId" value={sp.postId ?? ''} />
          <input type="hidden" name="tagId" value={sp.tagId ?? ''} />
          <input type="hidden" name="tipId" value={sp.tipId ?? ''} />
          <input type="hidden" name="uwpUserId" value={sp.uwpUserId ?? ''} />
          <label className="text-xs text-zinc-500">
            postId
            <input
              name="ptPostId"
              type="number"
              defaultValue={sp.ptPostId ?? ''}
              placeholder="1"
              className={inputCls}
            />
          </label>
          <label className="text-xs text-zinc-500">
            tagId
            <input
              name="ptTagId"
              type="number"
              defaultValue={sp.ptTagId ?? ''}
              placeholder="1"
              className={inputCls}
            />
          </label>
          <button type="submit" className={btnCls}>
            查询
          </button>
        </form>

        <SubCard title="getPostsTagsByPostId(postId)">
          {ptByPostIdRes !== null ? (
            <Pre data={ptByPostIdRes} />
          ) : (
            <p className="text-xs text-zinc-500">填入 postId 后会显示结果。</p>
          )}
        </SubCard>

        <SubCard title="getPostsTagsByTagId(tagId)">
          {ptByTagIdRes !== null ? (
            <Pre data={ptByTagIdRes} />
          ) : (
            <p className="text-xs text-zinc-500">填入 tagId 后会显示结果。</p>
          )}
        </SubCard>

        <SubCard title="getPostsTagsByPostIdAndTagId(postId, tagId)">
          {ptByBothRes !== null ? (
            <Pre data={ptByBothRes} />
          ) : (
            <p className="text-xs text-zinc-500">
              postId 和 tagId 都填入时会显示组合主键查询结果。
            </p>
          )}
        </SubCard>
      </Section>

      <Section
        title="④ 多级 relation 查询：getUserWithPosts(userId)"
        hint="使用 db.query.usersTable.findFirst + with，一次性拿到 user → posts → tagGroups (posts_tags) → tag 的 3 级嵌套数据。"
      >
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="userId" value={sp.userId ?? ''} />
          <input type="hidden" name="postId" value={sp.postId ?? ''} />
          <input type="hidden" name="tagId" value={sp.tagId ?? ''} />
          <input type="hidden" name="tipId" value={sp.tipId ?? ''} />
          <input type="hidden" name="ptPostId" value={sp.ptPostId ?? ''} />
          <input type="hidden" name="ptTagId" value={sp.ptTagId ?? ''} />
          <label className="text-xs text-zinc-500">
            userId
            <input
              name="uwpUserId"
              type="number"
              defaultValue={sp.uwpUserId ?? ''}
              placeholder="1"
              className={inputCls}
            />
          </label>
          <button type="submit" className={btnCls}>
            查询
          </button>
        </form>

        {userWithPostsRes === null ? (
          <p className="text-xs text-zinc-500">填入 userId 后展示嵌套结果。</p>
        ) : userWithPostsRes === undefined ? (
          <p className="text-xs text-red-500">未找到该 user。</p>
        ) : (
          <>
            <SubCard title="结构化展示">
              <div className="rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                <div>
                  <span className="font-mono text-zinc-500">user</span>{' '}
                  #{userWithPostsRes.id} · {userWithPostsRes.email}
                </div>
                <ul className="ml-4 mt-2 list-disc space-y-2">
                  {userWithPostsRes.posts.length === 0 && (
                    <li className="text-zinc-500">(no posts)</li>
                  )}
                  {userWithPostsRes.posts.map((post) => (
                    <li key={post.id}>
                      <div>
                        <span className="font-mono text-zinc-500">post</span>{' '}
                        #{post.id} · {post.title}
                      </div>
                      <ul className="ml-4 mt-1 list-[circle] space-y-1">
                        {post.tagGroups.length === 0 && (
                          <li className="text-zinc-500">(no tags)</li>
                        )}
                        {post.tagGroups.map((tg) => (
                          <li key={`${tg.postId}-${tg.tagId}`}>
                            <span className="font-mono text-zinc-500">
                              tag
                            </span>{' '}
                            #{tg.tag.id} · {tg.tag.content}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            </SubCard>
            <SubCard title="原始 JSON">
              <Pre data={userWithPostsRes} />
            </SubCard>
          </>
        )}
      </Section>

      <Section
        title="⑤ CRUD 操作（Server Actions）"
        hint="表单 action 绑定 'use server' 函数；执行后 revalidatePath('/demo') 刷新列表。"
      >
        <UserCrud />

        <SubCard title="posts — create / update / delete">
          <form
            action={createPostAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="title"
              required
              placeholder="title"
              className={inputCls}
            />
            <input
              name="content"
              required
              placeholder="content"
              className={inputCls}
            />
            <input
              name="userId"
              type="number"
              required
              placeholder="userId"
              className={inputCls}
            />
            <button type="submit" className={btnCls}>
              createPost
            </button>
          </form>

          <form
            action={updatePostAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-5"
          >
            <input
              name="id"
              type="number"
              required
              placeholder="id"
              className={inputCls}
            />
            <input name="title" placeholder="title (可选)" className={inputCls} />
            <input
              name="content"
              placeholder="content (可选)"
              className={inputCls}
            />
            <input
              name="userId"
              type="number"
              placeholder="userId (可选)"
              className={inputCls}
            />
            <button type="submit" className={btnCls}>
              updatePost
            </button>
          </form>

          <form
            action={deletePostAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="id"
              type="number"
              required
              placeholder="id"
              className={inputCls}
            />
            <button type="submit" className={btnDangerCls}>
              deletePost
            </button>
          </form>
        </SubCard>

        <SubCard title="tags — create / update / delete">
          <form
            action={createTagAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="content"
              required
              placeholder="content"
              className={inputCls}
            />
            <input
              name="userId"
              type="number"
              required
              placeholder="userId"
              className={inputCls}
            />
            <button type="submit" className={btnCls}>
              createTag
            </button>
          </form>

          <form
            action={updateTagAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="id"
              type="number"
              required
              placeholder="id"
              className={inputCls}
            />
            <input
              name="content"
              placeholder="content (可选)"
              className={inputCls}
            />
            <input
              name="userId"
              type="number"
              placeholder="userId (可选)"
              className={inputCls}
            />
            <button type="submit" className={btnCls}>
              updateTag
            </button>
          </form>

          <form
            action={deleteTagAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="id"
              type="number"
              required
              placeholder="id"
              className={inputCls}
            />
            <button type="submit" className={btnDangerCls}>
              deleteTag
            </button>
          </form>
        </SubCard>

        <SubCard title="tips — create / update / delete">
          <form
            action={createTipAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="content"
              required
              placeholder="content"
              className={inputCls}
            />
            <input
              name="tagId"
              type="number"
              required
              placeholder="tagId"
              className={inputCls}
            />
            <button type="submit" className={btnCls}>
              createTip
            </button>
          </form>

          <form
            action={updateTipAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="id"
              type="number"
              required
              placeholder="id"
              className={inputCls}
            />
            <input
              name="content"
              placeholder="content (可选)"
              className={inputCls}
            />
            <input
              name="tagId"
              type="number"
              placeholder="tagId (可选)"
              className={inputCls}
            />
            <button type="submit" className={btnCls}>
              updateTip
            </button>
          </form>

          <form
            action={deleteTipAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <input
              name="id"
              type="number"
              required
              placeholder="id"
              className={inputCls}
            />
            <button type="submit" className={btnDangerCls}>
              deleteTip
            </button>
          </form>
        </SubCard>

        <SubCard title="posts_tags — create / delete（多对多连接）">
          <form
            action={createPostsTagsAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            <input
              name="postId"
              type="number"
              required
              placeholder="postId"
              className={inputCls}
            />
            <input
              name="tagId"
              type="number"
              required
              placeholder="tagId"
              className={inputCls}
            />
            <button type="submit" className={btnCls}>
              createPostsTags
            </button>
          </form>

          <form
            action={deletePostsTagsAction}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            <input
              name="postId"
              type="number"
              required
              placeholder="postId"
              className={inputCls}
            />
            <input
              name="tagId"
              type="number"
              required
              placeholder="tagId"
              className={inputCls}
            />
            <button type="submit" className={btnDangerCls}>
              deletePostsTags
            </button>
          </form>

          <p className="text-xs text-zinc-500">
            注：<code>posts_tags</code> 表只有 <code>postId + tagId</code>{' '}
            两个字段且都是主键，没有可更新字段。<code>updatePostsTags</code>{' '}
            的 query 仍存在于代码中（用于演示 update API 的写法），但在 demo
            里不暴露表单 —— 真正修改"哪个 post 关联哪个 tag" 应通过先 delete
            再 create 完成。
          </p>
        </SubCard>
      </Section>
    </main>
  );
}
