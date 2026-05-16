# 10 · 分页 UI 实战：URL 即状态 + Server Component + 客户端分页器

> 上下文：写完 filter 后给 user list 加分页器。这一篇汇总「数据层（双查询拿 total）+ UI 层（Pagination 组件）+ URL 状态同步」三件套，是 Next 15 标准姿势。

---

## 大图：URL 即状态的完整数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                     URL                                          │
│  /crud/user/list?postStatus=published&offset=10&limit=5          │
│             ↑               ↓                                     │
│             │               │                                     │
│   FilterBar/Pagination     Server Component                      │
│   (Client, 改 URL)         (await searchParams)                   │
│             ↑               ↓                                     │
│             │     normalizeSearchParams (string → 类型)           │
│             │               ↓                                     │
│             │     getUsersInfoWithFilter2(params)                │
│             │               ↓                                     │
│             │     Promise.all([data, count])  ← 双查询            │
│             │               ↓                                     │
│             │     {users, total, hasNextPage, ...}                │
│             │               ↓                                     │
│             └────  Pagination 组件渲染（拿 props）                 │
└─────────────────────────────────────────────────────────────────┘
```

3 条铁律：

1. **状态在 URL，不在 React state**——刷新、分享、后退都正确
2. **Server Component 解析 URL → 调 query → render**——零 client state
3. **Client Component 只管"改 URL"**——`router.push` + 保留其他参数

---

## 数据层：双查询拿 total

Drizzle 没有"data + total 一体"接口，必须自己跑两条 SQL。

```ts
import { count, countDistinct } from 'drizzle-orm';

export const getUsersInfoWithFilter2 = async (params: IPostsAndTagsRequest) => {
  const where = buildUserWhere(params);          // 提取出来，两边复用
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 5;

  const [users, totalRows] = await Promise.all([
    // 数据查询：Relational + 嵌套关系
    db.query.usersTable.findMany({
      where,
      limit,
      offset,
      orderBy: (u, { asc }) => asc(u.id),         // 必须有稳定排序
      with: { posts: { with: { tagsGroup: { with: { tag: true } } } } },
    }),
    // COUNT 查询：用 builder（relational 没 count 接口）
    db.select({ total: count() }).from(usersTable).where(where),
  ]);

  const total = totalRows[0]?.total ?? 0;
  return {
    users,
    total,
    pageIndex: Math.floor(offset / limit) + 1,
    pageSize: limit,
    hasNextPage: offset + users.length < total,    // < 不是 >
    hasPreviousPage: offset > 0,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    cursorIndex: users.length > 0 ? users[users.length - 1].id : null,
  };
};
```

### 4 个 pitfall

| pitfall | 后果 | 修复 |
|---|---|---|
| 两边 `where` 不一致 | 显示"100 条"但分页只有 5 条 | 提取 `const where = ...` 复用 |
| 缺 `orderBy` | OFFSET 翻页可能重复或漏行 | 加 `orderBy: asc(id)`，必须单调字段 |
| `hasNextPage` 用 `>` | 永远 false，下一页按钮永远 disabled | 改成 `offset + users.length < total` |
| `users[users.length - 1].id` | 空数组下标越界 | `users.length > 0 ? ... : null` |

### 用 `countDistinct` 还是 `count`？

| Query 形态 | 用哪个 |
|---|---|
| 主表 + WHERE 含 subquery（不 join） | `count()` 即可 |
| 主表 + leftJoin（builder 风格，有 row explosion） | **必须** `countDistinct(usersTable.id)` 防重复计数 |

---

## URL 解析：`normalizeSearchParams`

URL 上的 `?userId=3` 解析出来是**字符串** `"3"`，但你的 query 函数要 `number`。Server Component 必须做这层转换：

```ts
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
  };
}
```

**生产代码这里应该用 Zod schema**——`z.coerce.number()` 自动 string→number + 校验。但 demo 阶段手写 `toNum` 也够用。

---

## Pagination 组件：5 个设计要点

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function Pagination({ pageIndex, pageSize, totalPages, total, hasNextPage, hasPreviousPage }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // 1. 保留其他 URL 参数（不能丢 filter）
  const buildHref = (newOffset: number, newLimit?: number) => {
    const params = new URLSearchParams(searchParams.toString());  // ← 拷贝现有
    params.set('offset', String(newOffset));
    if (newLimit !== undefined) params.set('limit', String(newLimit));
    return `?${params.toString()}`;
  };

  // 2. router.push 包在 useTransition，自动 isPending
  const goToPage = (page: number) => {
    if (page === pageIndex || page < 1 || page > totalPages || isPending) return;
    startTransition(() => router.push(buildHref((page - 1) * pageSize)));
  };

  // 3. 改 pageSize 自动回第 1 页
  const changePageSize = (newSize: number) => {
    if (newSize === pageSize) return;
    startTransition(() => router.push(buildHref(0, newSize)));
  };

  // 4. 智能省略号：超过 7 页只显示首末 + 当前 ±1
  const visiblePages = getVisiblePages(pageIndex, totalPages);

  // 5. a11y：nav aria-label + aria-current="page"
  return (
    <nav aria-label="分页导航">
      <button disabled={!hasPreviousPage || isPending} onClick={() => goToPage(pageIndex - 1)}>
        上一页
      </button>
      {visiblePages.map(p => p === 'ellipsis' ? <span>…</span> : (
        <button
          aria-current={p === pageIndex ? 'page' : undefined}
          onClick={() => goToPage(p)}
        >
          {p}
        </button>
      ))}
      <button disabled={!hasNextPage || isPending} onClick={() => goToPage(pageIndex + 1)}>
        下一页
      </button>
    </nav>
  );
}
```

### 智能省略号算法

```ts
function getVisiblePages(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
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
// 例：getVisiblePages(5, 20) → [1, 'ellipsis', 4, 5, 6, 'ellipsis', 20]
```

---

## URL 即状态的 5 个免费功能

用 URL 作为分页状态而不是 React state，**自动获得**：

1. **可分享**：复制 URL 给同事，看到的就是同一页同一筛选
2. **可收藏**：浏览器书签存的就是当前视图
3. **可后退**：浏览器后退按钮天然回到上一页（state 历史也是 URL 历史）
4. **可刷新**：F5 不丢分页位置
5. **SEO 友好**：搜索引擎能 crawl 到每一页

**反例**：如果用 `useState` 存 page，刷新就回第 1 页、后退按钮乱跳。

---

## `useTransition` 让 router.push 异步且可视化

```ts
const [isPending, startTransition] = useTransition();

startTransition(() => router.push(href));
```

期间 `isPending = true`：
- 数字旁显示 "加载中..."
- 所有按钮 + select 全 disabled，防竞态
- 等 server 渲染完才 false

不用自己写 loading state、不用 setTimeout、不用防抖。这跟 muscle memory 第 11 条「useTransition」直接对应。

---

## 改 filter 自动回第 1 页（关键 UX 细节）

`FilterBar.handleApply` 里 **不带 limit/offset**：

```ts
const buildHref = () => {
  const params = new URLSearchParams();   // ← 空开始，不拷贝现有
  if (postStatus) params.set('postStatus', postStatus);
  // ... 5 个 filter，但不 set offset / limit
  return `?${params.toString()}`;
};
```

否则会出现"在第 5 页加新筛选 → URL 变成 `?postStatus=draft&offset=20`，但 draft 总共只有 5 条 → 显示空"的尴尬。

**改 filter = 重新搜索 = 回第 1 页**，符合用户直觉。

---

## 完整请求时序

```
用户点页码 3
  ↓
goToPage(3) → startTransition(() => router.push("?offset=10"))
  ↓ isPending = true
按钮全 disabled，显示"加载中..."
  ↓
浏览器导航到新 URL
  ↓
Server Component 重新执行：
  - await searchParams → { offset: "10", limit: "5", ... }
  - normalizeSearchParams → { offset: 10, limit: 5, ... }
  - getUsersInfoWithFilter2(...) → { users, total, hasNextPage, ... }
  - render 新的 HTML/RSC payload
  ↓
浏览器收到新内容，hydrate
  ↓ isPending = false
按钮恢复，新数据显示
```

---

## 一句话内化

> **分页 = URL state + Server fetch + Client navigation 三件套。**
> 数据层 `Promise.all([data, count])` 必须 where 一致；UI 层 `router.push` 必须保留 filter；交互层 `useTransition` 让等待可见。
> 改 filter 回第 1 页、改 pageSize 回第 1 页——**所有"改变筛选语义"的操作都重置 offset**。

---

## Muscle Memory 关联

| 本笔记知识点 | 对应 Layer 4 muscle memory |
|---|---|
| URL state 模式 | 第 7 项「正确的 Server Action」的"边界即状态"思路 |
| useTransition 配 router.push | 第 11 项「useTransition」的实战应用 |
| 双查询 + Promise.all | 第 7 项「正确的 Server Action」的 DB 子项 |
| Cursor pagination 兜底 | 第 10 项「SSE server」的 stream 增量游标同源 |

---

## 相关笔记

- [02 · Cursor-Based 分页](./02-cursor-based-pagination.md)
- [09 · 生产级 Query 架构](./09-production-query-architecture.md)
- [11 · App Router 的 import 边界](./11-app-router-vs-pages-router-imports.md)
