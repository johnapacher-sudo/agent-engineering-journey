# 09 · `relations()` vs 数据库外键

## 一句话分工

```
数据库外键 (.references())   → 规则警察（DB 层，强制数据合规）
Drizzle relations()          → 查询向导（TS 层，帮你省 JOIN）
```

**必须两个都写**：
- `.references()` → DB 层防脏（不写则数据库无外键约束，脏数据随时能进）
- `relations()` → ORM 层便利查询（不写则要手写 JOIN）

## 对比表

| | 数据库外键 | Drizzle `relations()` |
|---|---|---|
| 在哪一层 | 数据库（SQL） | Drizzle ORM（TypeScript） |
| 作用 | 保证数据不乱 | 让查询写起来方便 |
| 会生成 SQL 吗 | 会（`FOREIGN KEY` 约束） | **不会**，一行都不生成 |
| 删了会怎样 | 数据库允许脏数据 | 数据库毫无影响，只是要手写 JOIN |

## 没 `relations()` → 手写 JOIN（Select API）

```typescript
const result = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(posts.userId, users.id))
  .where(eq(users.id, 1));
// 结果扁平，每行 { user, post }，自己拼对象
```

## 有 `relations()` → Query API 一行搞定

```typescript
// schema.ts 追加
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
}));
```

查询变优雅：

```typescript
const user = await db.query.users.findFirst({
  where: eq(users.id, 1),
  with: { posts: true },
});
// 结果直接嵌套：{ id, name, posts: [...] }
```

底层 Drizzle 还是帮你生成 JOIN（或两条 SELECT），只是你不用手写。

## 三个常见理解偏差（校正）

1. **"不写 relations() 就不能查关联"** — 错。手写 JOIN 一直能用。
2. **"relations() 自动创建外键"** — 错。它纯 TS，不生成任何 SQL 约束。
3. **"有了 relations() 就不能用 JOIN 了"** — 错。Drizzle 两套 API 共存：Query API（需 relations）和 Select API（不需要）。

## 多对多场景的完整 relations 写法

```typescript
export const postsRelations = relations(posts, ({ many }) => ({
  postsTags: many(postsTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postsTags: many(postsTags),
}));

export const postsTagsRelations = relations(postsTags, ({ one }) => ({
  post: one(posts, { fields: [postsTags.postId], references: [posts.id] }),
  tag:  one(tags,  { fields: [postsTags.tagId],  references: [tags.id]  }),
}));
```

查询能一路穿透：

```typescript
await db.query.posts.findFirst({
  where: eq(posts.id, 1),
  with: {
    postsTags: {
      with: { tag: true },   // ← 穿透到 tag
    },
  },
});
// { id, title, postsTags: [{ postId, tagId, tag: { id, name } }, ...] }
```

## 记忆锚点

```
数据库外键 → 规则警察（强制数据合规，跑在 DB）
relations() → 查询向导（帮你走捷径，跑在 TS）
```

两个工作人员互不干扰：
- 没有警察，向导还能工作（查询能跑，但数据会乱）
- 没有向导，警察照常巡逻（数据干净，但查询得自己写路）
- **两个都有才最舒服**

## 验证方法

在 schema.ts 故意删掉 `relations()` 那几行（保留外键）→ `drizzle-kit generate` → 对比 SQL 文件，会发现**一行都没变**。这是 `relations()` 纯 TS 的最直接证据。
