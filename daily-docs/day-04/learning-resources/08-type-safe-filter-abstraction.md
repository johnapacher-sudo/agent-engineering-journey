# 08 · Type-safe Filter 抽象：FilterMap + per-field handler

> 上下文：写 `buildFilterConditions` 的时候想用 `Object.entries(params).forEach(([k, v]) => eq(k, v))` 这种"通用反射"写法，结果 TS 一直要求 `any`。背后是 ORM Column 类型 vs 字符串字段名的本质鸿沟。

---

## 反例：为什么"通用反射"行不通

```ts
const buildFilterConditions = (params: IPostsAndTagsRequest) => {
  const conditions: SQL[] = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      conditions.push(eq(key as any, value));  // ⚠️ as any
    }
  });
};
```

**问题**：`eq()` 的第一个参数要的是 **Drizzle Column 对象**（带表 + 列 + 类型信息），而不是字符串。

但 `Object.entries(params)` 给你的 `key` 只是个字符串 `"postTagName"` / `"postStatus"`——**字符串到 Column 之间没有任何映射关系**：
- `postTagName` 这个字段名在哪张表的哪一列？
- TS 不知道，Drizzle 也不知道。

**你必须在某个地方显式声明这个映射**。

---

## 方案 1（推荐）：直接 `and(...)` 拼

字段不多时根本不需要"通用 builder"——Drizzle 的 `and()` 接受 `undefined` 并自动跳过：

```ts
import { and, eq, type SQL } from 'drizzle-orm';

const buildFilterConditions = ({
  postTagName,
  postStatus,
}: IPostsAndTagsRequest): SQL | undefined =>
  and(
    postTagName ? eq(tagsTable.name, postTagName) : undefined,
    postStatus ? eq(postsTable.status, postStatus) : undefined,
  );
```

**`and()` 的 undefined 行为速查**：

| 输入 | `and()` 返回 | `.where()` 行为 |
|---|---|---|
| `and(undefined, undefined)` | `undefined` | 跳过整个 WHERE 子句 |
| `and(eq(...), undefined)` | 等同于 `eq(...)` | 单条件 WHERE |
| `and(eq(a), eq(b), undefined)` | `(a AND b)` | 正常 |

`.where(undefined)` 也是安全的，Drizzle 会跳过这条 where 调用。

**优点**：完全类型安全，无 `any`；加新字段就是加一行；可读性极高。
**缺点**：不"通用"——但 2-3 个字段根本不需要通用。

---

## 方案 2：FilterMap + per-field handler（生产姿势）

字段会扩展、且不只是 `eq`（还有范围、模糊、多选）时，**最常用的生产模式**：

```ts
import { and, eq, gte, ilike, inArray, type SQL } from 'drizzle-orm';

// 1. 每个字段一个 handler，封装"如何把这个字段转成 SQL 条件"
type FilterHandler<V> = (value: NonNullable<V>) => SQL | undefined;
type FilterMap<T> = {
  [K in keyof T]?: FilterHandler<T[K]>;
};

// 2. 通用 builder（写一次，所有筛选场景复用）
function buildWhere<T extends Record<string, unknown>>(
  params: T,
  filters: FilterMap<T>,
): SQL | undefined {
  const conds: SQL[] = [];
  (Object.keys(filters) as Array<keyof T>).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    const handler = filters[key];
    if (!handler) return;
    const cond = handler(value as NonNullable<T[typeof key]>);
    if (cond) conds.push(cond);
  });
  return conds.length > 0 ? and(...conds) : undefined;
}

// 3. 每个 use case 定义自己的 filter map
export interface IUserSearchRequest {
  postTagName?: string;
  postStatus?: 'draft' | 'published' | 'archived';
  createdAfter?: Date;
  keyword?: string;
  userIds?: number[];
}

const USER_SEARCH_FILTERS: FilterMap<IUserSearchRequest> = {
  postTagName: (v) => inArray(
    usersTable.id,
    db
      .select({ id: postsTable.userId })
      .from(postsTable)
      .innerJoin(postsTagsTable, eq(postsTagsTable.postId, postsTable.id))
      .innerJoin(tagsTable, eq(tagsTable.id, postsTagsTable.tagId))
      .where(eq(tagsTable.name, v)),
  ),
  postStatus: (v) => inArray(
    usersTable.id,
    db
      .select({ id: postsTable.userId })
      .from(postsTable)
      .where(eq(postsTable.status, v)),
  ),
  createdAfter: (v) => gte(usersTable.createdAt, v),
  keyword: (v) => ilike(usersTable.userName, `%${v}%`),
  userIds: (v) => (v.length > 0 ? inArray(usersTable.id, v) : undefined),
};

// 4. 用起来
return db.query.usersTable.findMany({
  where: buildWhere(params, USER_SEARCH_FILTERS),
  ...
});
```

---

## 方案 2 为什么"优雅"

### 1. 字段类型 ↔ handler 输入类型自动对齐

`FilterMap<T>` 用 mapped types 锁死：每个 handler 收到的 `value` 类型**就是** `IUserSearchRequest` 里那个字段的非空类型。改 interface → handler 自动跟着报错。

### 2. 每个字段的 SQL 行为本地化

`postTagName` 用 `inArray + subquery`、`createdAfter` 用 `gte`、`keyword` 用 `ilike`、`userIds` 用 `inArray`——**每个字段的 SQL 翻译方式自描述**，不需要再去查"这个字段用什么操作符"。

### 3. 加字段成本极低

```diff
 export interface IUserSearchRequest {
   postTagName?: string;
+  publishedAfter?: Date;
 }

 const USER_SEARCH_FILTERS: FilterMap<IUserSearchRequest> = {
   postTagName: (v) => inArray(...),
+  publishedAfter: (v) => gte(postsTable.publishedAt, v),
 };
```

业务代码（`searchUsersInRepo`）一行不用改。

### 4. `buildWhere` 是真正可复用的

不仅 user 查询能用，post 列表查询、tag 管理后台查询、admin dashboard 都能复用。每个场景定义自己的 `xxxFilters` 即可。

### 5. 空值处理统一

`undefined / null / ''` 都被视为"未提供"，避免散落在各个 handler 里 `if (v)` 的重复判断。

---

## 进阶：双 FilterMap（外层筛 + 内层筛）

参考 [07 · 反向筛模式](./07-reverse-filter-pattern.md) 的"两层 where 必须语义一致"。生产里常常需要**同一份 input，外层和内层各自构造一份 SQL**：

```ts
const USER_LEVEL_FILTERS: FilterMap<SearchUsersInput> = {
  postTagName: (v) => inArray(usersTable.id, /* 子查询：有该 tag 的 user */),
  postStatus: (v) => inArray(usersTable.id, /* 子查询：有该 status post 的 user */),
};

const POST_LEVEL_FILTERS: FilterMap<SearchUsersInput> = {
  postTagName: (v) => inArray(postsTable.id, /* 子查询：含该 tag 的 post */),
  postStatus: (v) => eq(postsTable.status, v),
};

return db.query.usersTable.findMany({
  where: buildWhere(params, USER_LEVEL_FILTERS),    // 哪些 user
  with: {
    posts: {
      where: buildWhere(params, POST_LEVEL_FILTERS),  // 每个 user 拉哪些 post
      with: { tagsGroup: { with: { tag: true } } },
    },
  },
});
```

**好处**：同一份 input，外层和内层的语义被显式分开；加新字段时明确决定"这个字段是过滤 user 还是过滤 post 还是两者都过滤"。

---

## 抽象的"门槛"——什么时候值得用

| 场景 | 推荐方案 |
|---|---|
| 1-3 个简单 eq 字段 | 内联 `and(...)`（方案 1） |
| 4+ 字段，全是 eq | 简单 column map |
| **多种操作符（eq + gte + ilike + in）** | **per-field handler（方案 2）** |
| 需要前端 query string → server filter 的映射 | per-field handler + Zod schema 校验 |
| 跨多个查询复用同一套 filter | **必须** per-field handler |

**反模式警告**：在只有 2 个 eq 字段时强行抽象 `buildFilterConditions`，反而**比内联 `and()` 更难读**。"为了通用而通用"是经典过度工程。

---

## 小贴士：`as const satisfies` 双重保护

如果用更简单的"字段名 → 列对象"映射版本（不写 handler，每个字段都用 `eq`），可以这样确保类型安全：

```ts
import { type AnyColumn } from 'drizzle-orm';

const FILTER_COLUMN_MAP = {
  postTagName: tagsTable.name,
  postStatus: postsTable.status,
} as const satisfies Record<keyof IPostsAndTagsRequest, AnyColumn>;
```

- `as const` 保留每个字段的字面值类型
- `satisfies` 强制每个 key 必须是 `IPostsAndTagsRequest` 的字段，每个 value 必须是 `AnyColumn`
- 加新字段忘了登记 → 编译错

---

## 一句话内化

> Filter 抽象的本质是**「字段名 → SQL 表达式」的映射**。
> TS 帮不了你"反射"字段名到 Column 的对应关系——必须显式声明。
> 但显式声明可以做得**类型安全 + 业务自描述**——这就是 FilterMap + per-field handler 的价值。

---

## Muscle Memory 关联

- **第 5 项「tool 定义的 zod schema + execute 函数签名」**：FilterMap 的 mapped types 思维跟 zod schema 推导出 tool input 类型是同一套
- **第 7 项「正确的 Server Action（含 auth + 错误 envelope）」**：filter 抽象是 Server Action 入口校验后的常见下游步骤

---

## 相关笔记

- [07 · 反向筛 user：subquery + inArray 模式](./07-reverse-filter-pattern.md)
- [09 · 生产级 Query 架构](./09-production-query-architecture.md)
