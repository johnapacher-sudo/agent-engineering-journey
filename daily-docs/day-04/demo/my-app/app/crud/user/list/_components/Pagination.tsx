'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Props = {
  pageIndex: number;       // 当前页（1-based）
  pageSize: number;        // 每页大小
  totalPages: number;      // 总页数
  total: number;           // 总条数
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const btnBaseCls =
  'inline-flex h-8 min-w-8 items-center justify-center rounded border border-zinc-300 px-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700';
const btnIdleCls =
  'bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';
const btnActiveCls =
  'bg-blue-600 border-blue-600 text-white hover:bg-blue-500 dark:border-blue-500';

/**
 * 算"该显示哪些页码"——超长的中间用省略号
 *  例：current=5, total=20 → [1, '...', 4, 5, 6, '...', 20]
 *  例：current=2, total=5  → [1, 2, 3, 4, 5]
 */
function getVisiblePages(
  current: number,
  total: number,
): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
    result.push(sorted[i]);
  }
  return result;
}

export function Pagination({
  pageIndex,
  pageSize,
  totalPages,
  total,
  hasNextPage,
  hasPreviousPage,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // 改 URL 时保留其他筛选参数（重要：不能丢 postStatus 等）
  const buildHref = (newOffset: number, newLimit?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('offset', String(newOffset));
    if (newLimit !== undefined) params.set('limit', String(newLimit));
    return `?${params.toString()}`;
  };

  const goToPage = (page: number) => {
    if (page === pageIndex || page < 1 || page > totalPages || isPending) return;
    const offset = (page - 1) * pageSize;
    startTransition(() => {
      router.push(buildHref(offset));
    });
  };

  const changePageSize = (newSize: number) => {
    if (newSize === pageSize || isPending) return;
    // 改每页大小时回到第 1 页（offset=0）
    startTransition(() => {
      router.push(buildHref(0, newSize));
    });
  };

  // 当前页范围 "11-20"
  const startItem = total === 0 ? 0 : (pageIndex - 1) * pageSize + 1;
  const endItem = Math.min(pageIndex * pageSize, total);

  const visiblePages = getVisiblePages(pageIndex, totalPages);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="分页导航"
    >
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {total === 0 ? (
          <span>无数据</span>
        ) : (
          <>
            显示 <span className="font-mono text-zinc-900 dark:text-zinc-100">{startItem}-{endItem}</span>
            {' '}/ 共 <span className="font-mono text-zinc-900 dark:text-zinc-100">{total}</span> 条
            {' · '}
            第 <span className="font-mono text-zinc-900 dark:text-zinc-100">{pageIndex}</span>
            {' / '}
            <span className="font-mono text-zinc-900 dark:text-zinc-100">{totalPages}</span> 页
            {isPending && <span className="ml-2 text-zinc-400">加载中...</span>}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`${btnBaseCls} ${btnIdleCls}`}
          disabled={!hasPreviousPage || isPending}
          onClick={() => goToPage(pageIndex - 1)}
          aria-label="上一页"
        >
          ‹ 上一页
        </button>

        <div className="flex items-center gap-1">
          {visiblePages.map((p, i) =>
            p === 'ellipsis' ? (
              <span
                key={`e-${i}`}
                className="px-1 text-sm text-zinc-400"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`${btnBaseCls} ${p === pageIndex ? btnActiveCls : btnIdleCls}`}
                disabled={isPending}
                onClick={() => goToPage(p)}
                aria-current={p === pageIndex ? 'page' : undefined}
                aria-label={`第 ${p} 页`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          className={`${btnBaseCls} ${btnIdleCls}`}
          disabled={!hasNextPage || isPending}
          onClick={() => goToPage(pageIndex + 1)}
          aria-label="下一页"
        >
          下一页 ›
        </button>

        <label className="ml-2 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          每页
          <select
            className="h-8 rounded border border-zinc-300 bg-white px-1.5 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            disabled={isPending}
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          条
        </label>
      </div>
    </nav>
  );
}
