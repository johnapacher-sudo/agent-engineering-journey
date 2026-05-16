# 09 · 生产级 Query 架构：CQRS-lite + Repository + DTO

> 上下文：写完 `getUsersInfoWithFilter` 后开始问"大公司的代码到底怎么写"。这一篇汇总成熟工程团队的常见架构，以及 JOIN vs Relational 的真实性能对比。

---

## 成熟团队的 6 条共性

### 1. CQRS-lite：每个"读用例"一个独立 query 函数

不是一个超级灵活的 `getUserList(filters)` 应付所有场景。而是：

```
getUsersForAdminListPage(filters)     // 后台管理列表用
getUsersForUserDirectory(filters)     // 用户目录页用
getUsersForCsvExport(filters)         // 导出用
getUsersForApiV2(filters)             // 对外 API 用
```

每个函数：
- 只 SELECT 自己需要的列
- 各自调优自己的 index
- 各自定义返回 DTO
- 不互相复用底层 query

**为什么不复用**：业务需求会反向污染查询。比如「列表页要加个字段」结果改动了 API、Export、Admin 三个地方。**Read model 应该跟着 use case 走，不跟着 entity 走**。

### 2. 入口必校验：Zod schema → 类型 → 运行时

```ts
import { z } from 'zod';

const SearchUsersInput = z.object({
  postTagName: z.string().min(1).optional(),
  postStatus: z.enum(['draft', 'published', 'archived']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function searchUsersAction(rawParams: unknown) {
  const params = SearchUsersInput.parse(rawParams);
  // 之后整个调用链 params 都是 type-safe 的
}
```

**没有 Zod / Valibot / TypeBox 的入口都是裸奔**。

### 3. Repository 层：DB 操作不直接在 route / action 里写

```
src/
  features/users/
    schema.ts              ← Drizzle schema
    repository.ts          ← 所有 DB 操作（getUsersForXxx, createUser, ...）
    service.ts             ← 业务逻辑（含权限、组合多个 repo 调用、事务）
    actions.ts             ← Server actions（only：parse input → call service → format output）
    types.ts               ← Zod schema + DTO 类型
```

调用链永远是：**action → service → repository → drizzle**。

route / action 永远只做 3 件事：
1. 解析校验入参
2. 调用 service
3. 包装成响应（成功/错误 envelope）

### 4. Filter 抽象 = per-field handler

参考 [08 · Type-safe filter 抽象](./08-type-safe-filter-abstraction.md)。每个 use case 自己的 filter map，**不要全 entity 共享一个全局 map**。

### 5. Cursor-based 分页（不是 offset）

```ts
// 大数据量下慢、不稳定
.limit(20).offset(page * 20)

// 生产标配
.where(and(filter, gt(usersTable.id, cursor))).limit(20).orderBy(usersTable.id)
```

`offset` 在 LIMIT 1000000 时 DB 也得扫前 100 万行；cursor 利用 index 直接 seek。详见 [02 · Cursor-Based 分页](./02-cursor-based-pagination.md)。

### 6. DTO 转换：DB shape ≠ API shape

DB 出来的对象不要直接 return 给客户端。中间过一层 mapper：

```ts
function toUserDto(row: DbUserWithPosts): UserDto {
  return {
    id: row.id,
    name: row.userName,                            // 字段重命名
    postCount: row.posts.length,                   // 派生字段
    posts: row.posts.map(toPostDto),               // 嵌套也转
    // 注意：password、email 等敏感字段不出现
  };
}
```

**好处**：
- DB schema 改名不会破 API 契约
- 敏感字段在边界被显式过滤（secure by default）
- 客户端类型来自 DTO 而不是 DB inferSelect

---

## 生产姿势骨架（粘到 day-04 直接能跑）

```ts
// features/users/types.ts
import { z } from 'zod';

export const SearchUsersInput = z.object({
  postTagName: z.string().min(1).optional(),
  postStatus: z.enum(['draft', 'published', 'archived']).optional(),
  cursor: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchUsersInput = z.infer<typeof SearchUsersInput>;

export type UserListItemDto = {
  id: number;
  name: string;
  postCount: number;
  posts: { id: number; title: string; status: string; tags: string[] }[];
};
```

```ts
// features/users/repository.ts
import { and, eq, gt, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { usersTable, postsTable, tagsTable, postsTagsTable } from '@/db/schema';
import type { SearchUsersInput } from './types';

type FilterHandler<V> = (value: NonNullable<V>) => SQL | undefined;
type FilterMap<T> = { [K in keyof T]?: FilterHandler<T[K]> };

const USER_SEARCH_FILTERS: FilterMap<SearchUsersInput> = {
  postTagName: (v) => inArray(
    usersTable.id,
    db.select({ id: postsTable.userId })
      .from(postsTable)
      .innerJoin(postsTagsTable, eq(postsTagsTable.postId, postsTable.id))
      .innerJoin(tagsTable, eq(tagsTable.id, postsTagsTable.tagId))
      .where(eq(tagsTable.name, v)),
  ),
  postStatus: (v) => inArray(
    usersTable.id,
    db.select({ id: postsTable.userId })
      .from(postsTable)
      .where(eq(postsTable.status, v)),
  ),
};

function buildWhere<T extends Record<string, unknown>>(
  params: T, filters: FilterMap<T>,
): SQL | undefined {
  const conds: SQL[] = [];
  for (const key in filters) {
    const v = params[key];
    if (v === undefined || v === null || v === '') continue;
    const c = filters[key]?.(v as NonNullable<typeof v>);
    if (c) conds.push(c);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function searchUsersInRepo(params: SearchUsersInput) {
  return db.query.usersTable.findMany({
    where: and(
      buildWhere(params, USER_SEARCH_FILTERS),
      params.cursor ? gt(usersTable.id, params.cursor) : undefined,
    ),
    with: {
      posts: { with: { tagsGroup: { with: { tag: true } } } },
    },
    limit: params.limit + 1,  // 多取一条用于判 hasMore
    orderBy: (u, { asc }) => asc(u.id),
  });
}
```

```ts
// features/users/service.ts
import { searchUsersInRepo } from './repository';
import type { SearchUsersInput, UserListItemDto } from './types';

export async function searchUsers(params: SearchUsersInput) {
  const rows = await searchUsersInRepo(params);
  const hasMore = rows.length > params.limit;
  const visible = hasMore ? rows.slice(0, params.limit) : rows;

  const users: UserListItemDto[] = visible.map((u) => ({
    id: u.id,
    name: u.userName,
    postCount: u.posts.length,
    posts: u.posts.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      tags: p.tagsGroup.map((g) => g.tag.name),
    })),
  }));

  return {
    users,
    nextCursor: hasMore ? visible[visible.length - 1].id : null,
  };
}
```

```ts
// app/.../actions.ts
'use server';
import { SearchUsersInput } from '@/features/users/types';
import { searchUsers } from '@/features/users/service';

export async function searchUsersAction(rawParams: unknown) {
  const params = SearchUsersInput.parse(rawParams);  // 入口校验
  return searchUsers(params);                        // 调 service
}
```

---

## JOIN row explosion vs Relational tree：性能对比

### 两种写法

**写法 A：Builder + leftJoin**

```ts
const users = await db
  .select()
  .from(usersTable)
  .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
  .leftJoin(postsTagsTable, eq(postsTable.id, postsTagsTable.postId))
  .leftJoin(tagsTable, eq(postsTagsTable.tagId, tagsTable.id))
  .where(buildWhere(params, USER_SEARCH_FILTERS));
```

**写法 B：Relational + subquery**

```ts
return db.query.usersTable.findMany({
  where: buildWhere(params, USER_SEARCH_FILTERS),
  with: { posts: { with: { tagsGroup: { with: { tag: true } } } } },
});
```

### 真实性能对比

| 维度 | A (one big LEFT JOIN) | B (Relational + subquery) |
|---|---|---|
| **DB 往返次数** | 1 | 1（modern Drizzle 用 lateral + json_agg） |
| **wire 传输大小** | **大**——row explosion，user/post 字段被重复 N 倍 | 小——nested JSON 自然去重 |
| **DB 内存压力** | 中——构造 join 后大结果集 | 中——构造 JSON tree |
| **App 内存压力** | **大**——拿所有重复行 + group | 小——直接拿到目标形状 |
| **App CPU** | 你要写 group by 循环 | Drizzle 内部 stitch（C 实现） |
| **DB CPU** | 中——纯 JOIN | 中——`json_agg` 略贵 |

**举个数字**：1 个 user，100 篇 post，每篇 10 tag。

- **写法 A**：返回 100 × 10 = **1000 行**，每行重复整个 user record（约 200 bytes）→ wire 上传 200 KB；app 端循环 1000 次 group。
- **写法 B**：返回 1 个 user，**1 条 nested 记录** → wire 上 ~20 KB；app 端零 group。

**10 倍 wire 节省**。在数据量略大时差距明显。

### 重要的认知校正

> **"少 SQL 次数" ≠ "性能好"**。
> 真正的瓶颈通常是 **wire 传输 + app 内存**，不是往返次数。
> 看 SQL 慢查询要看 3 个指标：`EXPLAIN ANALYZE` 的 cost / wire bytes / app 内存峰值。

---

## DTO 的真正职责

DTO 是**业务级转换**，**不是任何方案的"替代品"**：

| 方案 | DTO 的工作 |
|---|---|
| Builder + flat row | **分组 + 转换**（双重工作） |
| Relational + subquery | **只转换**（分组 Drizzle 帮你做了） |

无论哪种方案 DTO 都需要——区别在 DTO 这层要不要顺带做"分组"。

DTO 真正负责的事：
- 字段重命名（`user_name` → `name`）
- 派生字段（`postCount = posts.length`）
- 隐藏敏感字段（`password` 不出现）
- 类型规范化（`Date` → ISO string）
- 嵌套递归转换

---

## 三层职责清晰图

```
+-----------------------------------------------------------+
| Drizzle relational query  ← 负责"结构装配"（user→posts→tags）|
|       ↓ 出来的是 nested 实体树                              |
|                                                            |
| DTO mapper                ← 负责"业务转换"（重命名/派生/隐藏）|
|       ↓ 出来的是 API 契约                                   |
|                                                            |
| Server Action / Route     ← 负责"传输 + 错误包装"           |
+-----------------------------------------------------------+
```

---

## 大公司**不**做的事（祛魅）

| 看上去高端 | 实际生产 |
|---|---|
| 自动反射生成 query 的"魔法" filter builder | 手写每个 use case 的 query，简单可读 |
| 一个超级灵活 `findEntity(filters)` 应付一切 | per-use-case 函数，各自调优 |
| 直接 return DB row 给前端 | 必须过 DTO 层 |
| 用 GraphQL 解决一切 | REST + 精心设计的端点更常见 |
| 写复杂 subquery 炫技 | 复杂的就 raw SQL，注释清楚 |
| 全用 ORM 的关联查询 | 复杂场景果断 raw SQL，简单的用 ORM |

---

## 何时果断 raw SQL

ORM 的 relational query 是**「实体取数」**工具，不是**「关系过滤」**工具。
用 relational 做关系过滤就像用螺丝刀拧螺母——能拧上，但不优雅。

**该用 raw SQL 的信号**：
- 复杂多表 GROUP BY + 聚合
- CTE / 窗口函数
- 性能 hot path（profile 显示 ORM 生成的 SQL 不优）
- 跨 schema / 跨数据库联查

**不该用 raw SQL 的信号**：
- 简单 CRUD（用 Drizzle 更安全）
- 字段名经常重构（用 Drizzle 自动跟着 schema）

---

## 一句话内化

> **生产代码 ≠ 高端代码**。生产代码 = **简单 + 边界明确 + 可观测 + 可改**。
>
> 重构成本最低的代码就是最"高级"的代码。能让你 6 个月后回来一眼看懂、改一个字段不破 5 个地方的代码，就是大公司在追求的。

---

## Muscle Memory 关联

| 笔记内容 | 对应 muscle memory |
|---|---|
| Zod schema + 入口校验 | 第 5 项「tool 定义的 zod schema + execute 函数签名」 |
| Server action 三段式（parse → service → format） | 第 7 项「正确的 Server Action（含 auth + 错误 envelope）」 |
| Repository / service 分层 | 跟 Inngest 的 step.run、Stripe 状态机一样的"职责分离"思维 |
| Cursor pagination | M2 Week 5-6 写 SSE parser 时的 stream 增量游标同源 |
| DTO 转换 | Anthropic Messages API 的请求/响应映射同源 |

---

## 相关笔记

- [02 · Cursor-Based 分页](./02-cursor-based-pagination.md)
- [06 · Drizzle 两套 API 的边界](./06-drizzle-relational-vs-builder.md)
- [07 · 反向筛 user：subquery + inArray 模式](./07-reverse-filter-pattern.md)
- [08 · Type-safe filter 抽象](./08-type-safe-filter-abstraction.md)
