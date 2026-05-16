# 07 · 反向筛主表：subquery + inArray 模式

> 上下文：写 `getAllUsersPostsAndTags({ postTagName, postStatus })` 时，需要"按 tag 名筛 user list"。这是关系数据建模里的经典痛点：**主表不直接存这个属性，要通过 M2M 关联表反向匹配**。

---

## 问题：什么叫"反向筛"

数据形状：

```
users  ──── 1:N ────  posts  ──── M:N ────  tags
                            (posts_tags)
```

**正向**：取 user → 它的 posts → 它们的 tags（顺着关系链取数）
**反向**：从 tag 名出发 → 找出"哪些 user 至少有一篇带这个 tag 的 post"

正向用 `with` 链就够（Relational query 的甜蜜区）。
反向必须借助 **subquery 或 join**（Relational query 的 `with` 链表达不了）。

---

## 三种"反向筛"语义（先想清楚再写代码）

假设查 `?postTagName=react`：

| 方案 | 返回的 user | 每个 user 的 posts | 每个 post 的 tagsGroup |
|---|---|---|---|
| **A. 只过滤 tagsGroup** | 全部 user | 全部 post | 只显示 react 这个 tag |
| **B. 过滤 post** | 全部 user（可能 posts 为空） | 只含 react 标签的 post | 显示该 post 的全部 tag |
| **C. 过滤 user + post** | 只剩"至少有一篇 react 文章"的 user | 同 B | 同 B |

- A 几乎没用：post 还在那里，只是 tag 列表少了几条 → 用户感知不到"按 react 筛"
- B 是大多数博客系统的语义："给我看带 react 标签的文章"
- C 进一步剔除"没有匹配文章"的用户，列表更干净，符合 `/crud/user/list?postTagName=react` 这个 URL 的直觉

**本笔记主推方案 C。**

---

## 方案 C：subquery + inArray 实现

```ts
import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '../index';
import {
  postsTable,
  postsTagsTable,
  usersTable,
  tagsTable,
} from '../schema';
import type { IPostsAndTagsRequest } from './select';

export const getAllUsersPostsAndTags = async ({
  postTagName,
  postStatus,
}: IPostsAndTagsRequest) => {
  // 子查询 1：哪些 post id 拥有指定 tag
  const postIdsWithTag = postTagName
    ? db
        .select({ id: postsTagsTable.postId })
        .from(postsTagsTable)
        .innerJoin(tagsTable, eq(tagsTable.id, postsTagsTable.tagId))
        .where(eq(tagsTable.name, postTagName))
    : null;

  // 子查询 2：哪些 user id 至少有一篇满足全部条件的 post
  const userIdsWithMatchingPost =
    postTagName || postStatus
      ? db
          .select({ id: postsTable.userId })
          .from(postsTable)
          .where(
            and(
              postStatus ? eq(postsTable.status, postStatus) : undefined,
              postIdsWithTag
                ? inArray(postsTable.id, postIdsWithTag)
                : undefined,
            ),
          )
      : null;

  // 主查询：Relational query 拿树形结果
  return db.query.usersTable.findMany({
    where: userIdsWithMatchingPost
      ? inArray(usersTable.id, userIdsWithMatchingPost)
      : undefined,
    with: {
      posts: {
        // 内层 where：每个 user 拉哪些 post
        where: (post, { and: andOp, eq: eqOp, inArray: inArrayOp }) =>
          andOp(
            postStatus ? eqOp(post.status, postStatus) : undefined,
            postIdsWithTag ? inArrayOp(post.id, postIdsWithTag) : undefined,
          ),
        with: {
          tagsGroup: {
            with: { tag: true },
            // 注意：tagsGroup 不加 where，让用户看到匹配 post 的全部 tag
          },
        },
      },
    },
  });
};
```

---

## 关键设计决策

### 1. 用 subquery 而不是大 JOIN

Drizzle 的 Relational query 是为「读某张表 + 它的关联」设计的，不擅长「按关联表的字段反向筛主表」。这种"反向筛"用 subquery 最干净——

> 子查询算"哪些 id 满足条件"，主查询用 `inArray` 接住。

可以把 `postIdsWithTag` 想成临时变量：「先算出有 react 标签的 post id 集合 = {3, 7, 12}」，再说「给我所有 post id 在这集合里的 post」。

### 2. 子查询是 lazy 的，会被内联到一条 SQL

`db.select(...).from(...).where(...)` 不带 `await` **不会立即执行**——它返回一个 SQL fragment。Drizzle 在生成最终 SQL 时把它内联进 `WHERE x IN (SELECT ...)`，**DB 一次往返**。这是性能上的关键。

### 3. 两层 where 必须语义一致

```
user.where:    user 至少有一篇满足 X 条件的 post
post.where:    post 必须满足 X 条件
```

**两个条件逻辑上一致**才不会出现"返回了 user 但 posts: []"的怪现象。所以把 `postIdsWithTag` 这个 subquery 提取出来复用，避免两边写两份容易不同步。

### 4. 嵌套 with 的 where 是局部的

这是容易踩的关键陷阱：

```ts
db.query.usersTable.findMany({
  where:  // ① 哪些 user 出现 ──→ 影响"列表长度"
  with: {
    posts: {
      where: // ② 每个 user 拉哪些 post ──→ 影响"每张 user 卡片里的 posts 数组"
      with: {
        tagsGroup: {
          where: // ③ 每个 post 拉哪些 tag ──→ 影响"tagsGroup 数组"
        }
      }
    }
  }
})
```

**每一层 `where` 只管自己那一层**。`with` 不会自动级联过滤。

> 想要"内外一致"必须**显式写两遍**——这不是缺陷，是 ORM 把语义控制权交还给你。

### 5. tagsGroup 故意不加 where

旧代码原本想"只显示匹配的 tag"，但那是语义 A，几乎没人用。让 `tagsGroup` 返回该 post 的全部 tag——用户看到 react 文章上还挂着 frontend、demo 标签，是 bonus 信息。

---

## 三种语义的 where 配置速查

| 方案 | 主表 where | posts.where | tagsGroup.where |
|---|---|---|---|
| A | 无 | 无 | `eq(tag.name, X)` |
| B | 无 | `inArray(post.id, postIdsWithTag)` | 无 |
| C | `inArray(user.id, userIdsWithMatchingPost)` | `inArray(post.id, postIdsWithTag)` | 无 |

---

## 性能提醒（Layer 4，先 know，别动手优化）

这个查询在大数据量下会跑多条嵌套 SQL（user → posts per user → tagsGroup per post），是 Drizzle relational query 的"分批 SELECT"模式。如果 user 上万、每个 user 上百 post，单页加载会变慢。生产场景的优化方向：

1. 改写成**单条 SQL with `json_agg`**（PostgreSQL 特性）—— 一次查全部
2. 在 user / post / tag 的 hot path 上加 cursor 分页
3. 上 N+1 监控（Drizzle 暂没现成 hook，可用 Postgres 的 `pg_stat_statements`）

day-04 demo 不用做这层，但记进笔记，写真正 production server action 时会用到。

---

## 一句话内化

> 「按关联表字段反向筛主表」=「subquery 算出 id 集合 + 主表 `inArray` 接住」。
> 嵌套 `with` 的每一层 `where` 是**独立局部过滤器**，不会级联。
> 想要内外一致就**显式写两遍**——本质上是同一份语义在两层 SQL 里各自表达一次。

---

## Muscle Memory 关联

- **第 7 项「正确的 Server Action」**：复杂查询是 server action 的常见职责；subquery + inArray 是该职责的标配工具
- **思维迁移**：「反向查询 + app 层 reshape」这个 pattern 在写 Agent 的 tool 调用历史时会反复出现（例：从 tool_call_id 反查 conversation → user → all messages）

---

## 相关笔记

- [06 · Drizzle 两套 API 的边界](./06-drizzle-relational-vs-builder.md)
- [08 · Type-safe filter 抽象](./08-type-safe-filter-abstraction.md)
