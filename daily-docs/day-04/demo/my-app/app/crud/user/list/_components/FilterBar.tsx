'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { IPostsAndTagsRequest } from '@/db/queries/select';

type SelectOption = {
  id: number;
  label: string;
};

type TagOption = {
  id: number;
  name: string;
};

type Props = {
  initial: IPostsAndTagsRequest;
  users: SelectOption[];
  posts: SelectOption[];
  tags: TagOption[];
};

const STATUS_OPTIONS: Array<'draft' | 'published' | 'archived'> = [
  'draft',
  'published',
  'archived',
];

const inputCls =
  'w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

const labelCls =
  'text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';

export function FilterBar({ initial, users, posts, tags }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 用 string 作为 state（select 的 value 都是字符串），"" = 不筛选
  const [userId, setUserId] = useState<string>(
    initial.userId !== undefined ? String(initial.userId) : '',
  );
  const [postId, setPostId] = useState<string>(
    initial.postId !== undefined ? String(initial.postId) : '',
  );
  const [postTagId, setPostTagId] = useState<string>(
    initial.postTagId !== undefined ? String(initial.postTagId) : '',
  );
  const [postTagName, setPostTagName] = useState<string>(
    initial.postTagName ?? '',
  );
  const [postStatus, setPostStatus] = useState<string>(
    initial.postStatus ?? '',
  );

  const buildHref = () => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (postId) params.set('postId', postId);
    if (postTagId) params.set('postTagId', postTagId);
    if (postTagName) params.set('postTagName', postTagName);
    if (postStatus) params.set('postStatus', postStatus);
    const qs = params.toString();
    return qs ? `/crud/user/list?${qs}` : '/crud/user/list';
  };

  const handleApply = () => {
    startTransition(() => {
      router.push(buildHref());
    });
  };

  const handleReset = () => {
    setUserId('');
    setPostId('');
    setPostTagId('');
    setPostTagName('');
    setPostStatus('');
    startTransition(() => {
      router.push('/crud/user/list');
    });
  };

  const hasAny =
    userId || postId || postTagId || postTagName || postStatus;

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          筛选条件
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          组合后点击「应用筛选」
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>userId</span>
          <select
            className={inputCls}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isPending}
          >
            <option value="">全部</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                #{u.id} · {u.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>postId</span>
          <select
            className={inputCls}
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
            disabled={isPending}
          >
            <option value="">全部</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id} · {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>postTagId</span>
          <select
            className={inputCls}
            value={postTagId}
            onChange={(e) => setPostTagId(e.target.value)}
            disabled={isPending}
          >
            <option value="">全部</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.id} · {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>postTagName</span>
          <select
            className={inputCls}
            value={postTagName}
            onChange={(e) => setPostTagName(e.target.value)}
            disabled={isPending}
          >
            <option value="">全部</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelCls}>postStatus</span>
          <select
            className={inputCls}
            value={postStatus}
            onChange={(e) => setPostStatus(e.target.value)}
            disabled={isPending}
          >
            <option value="">全部</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {hasAny && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            重置
          </button>
        )}
        <button
          type="button"
          onClick={handleApply}
          disabled={isPending}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? '加载中...' : '应用筛选'}
        </button>
      </div>
    </section>
  );
}
