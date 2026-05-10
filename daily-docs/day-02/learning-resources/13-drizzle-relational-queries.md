# Drizzle Relational Queries 学习笔记

## 前置：`{ schema }` 的作用

```ts
// db/index.ts
import * as schema from './schema';
export const db = drizzle(sql, { schema });
```

`{ schema }` 做两件事：
1. **运行时**：让 Drizzle 知道有哪些表和 relations，`db.query` 才能生成正确的 SQL
2. **类型层面**：让 TypeScript 推导出 `db.query` 上有哪些表、返回什么类型

不加的话 `db.query` 属性根本不存在。

## Relations vs Foreign Keys

| | Foreign Key | Relations |
|---|---|---|
| 层级 | 数据库约束 | 应用层抽象 |
| 作用 | insert/update/delete 时检查完整性 | 让 `db.query` 能做关联查询 |
| 是否影响 schema | 是（建表时创建） | 否（不产生任何数据库对象） |
| 能否单独使用 | 能 | 能 |
| 能否配合使用 | 能 | 能 |

两者完全独立，不互相依赖。

## 三种关系定义

### One-to-One：`one()`

```ts
// FK 在 profileInfo 那边，users 这边不需要 fields/references
export const usersRelations = relations(users, ({ one }) => ({
  profileInfo: one(profileInfo),
}));
```

省略 fields/references 时，TypeScript 推断为 nullable。

### One-to-Many：`many()` + `one()`

```ts
// "一"的那边用 many
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

// "多"的那边用 one + fields/references
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.userId], references: [users.id] }),
}));
```

口诀：有 FK 的表写 `one` + fields，另一边写 `many`。

### Many-to-Many：中间表（junction table）

```ts
// 中间表用复合主键
export const usersToGroups = pgTable('users_to_groups', {
  userId: integer('user_id').notNull().references(() => users.id),
  groupId: integer('group_id').notNull().references(() => groups.id),
}, (t) => [primaryKey({ columns: [t.userId, t.groupId] })]);

// 两边都 many → 中间表
export const usersRelations = relations(users, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

// 中间表 → 两边都 one
export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  group: one(groups, { fields: [usersToGroups.groupId], references: [groups.id] }),
  user: one(users, { fields: [usersToGroups.userId], references: [users.id] }),
}));
```

口诀：多对多 = 两边 `many(中间表)` + 中间表里两个 `one()`。

## Relational Query API（`db.query`）

Relational query **只有 select**，不支持 insert/update/delete。增删改用 core API（`db.insert`/`db.update`/`db.delete`）。

### 为什么需要 relational query？

`db.select` + JOIN 返回的是**扁平行**，一对多关系会产生重复数据，需要手动去重、分组、拼成嵌套结构。Relational query 自动完成这件事。

```ts
// core API 返回扁平行，需要手动组装
const rows = await db.select().from(usersTable)
  .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
  .leftJoin(commentsTable, eq(postsTable.id, commentsTable.postId));

// relational query 直接返回嵌套结构
const result = await db.query.usersTable.findMany({
  with: { posts: { with: { comments: true } } },
});
```

始终只生成**一条 SQL**（用 lateral join 实现）。

### 核心方法

```ts
db.query.usersTable.findMany();   // 返回数组
db.query.usersTable.findFirst();  // 返回单条，自动加 limit 1
```

### `with` — 加载关联数据

```ts
// 一层
db.query.usersTable.findMany({ with: { posts: true } });

// 多层嵌套
db.query.usersTable.findMany({
  with: { posts: { with: { comments: true } } },
});
```

### `columns` — 选择/排除字段

```ts
// 只要 id 和 content
db.query.postsTable.findMany({
  columns: { id: true, content: true },
  with: { comments: true },
});

// 排除 content，保留其他所有
db.query.postsTable.findMany({
  columns: { content: false },
});

// 嵌套关系也可以
db.query.postsTable.findMany({
  columns: { id: true, content: true },
  with: { comments: { columns: { userId: false } } },
});
```

注意：`true` 和 `false` 混用时，`false` 会被忽略。

### `where` — 过滤

```ts
// 简单等于
db.query.usersTable.findMany({ where: eq(usersTable.id, 1) });

// 嵌套 where（只过滤关联数据，不影响主查询）
db.query.postsTable.findMany({
  where: eq(postsTable.id, 1),
  with: {
    comments: {
      where: lt(commentsTable.createdAt, new Date()),
    },
  },
});
```

### `limit` & `offset` — 分页

```ts
db.query.postsTable.findMany({
  limit: 5,
  offset: 10,
  with: { comments: { limit: 3 } },  // 每篇 post 最多 3 条 comment
});
```

### `orderBy` — 排序

```ts
db.query.postsTable.findMany({
  orderBy: [asc(postsTable.id)],
  with: { comments: { orderBy: [desc(commentsTable.id)] } },
});
```

### `extras` — 自定义计算字段

```ts
db.query.usersTable.findMany({
  extras: {
    loweredName: sql`lower(${usersTable.name})`.as('lowered_name'),
  },
});
```

注意：聚合函数（COUNT、SUM 等）不支持在 extras 里用。

### Prepared Statements

```ts
const prepared = db.query.usersTable.findMany({
  where: eq(usersTable.id, placeholder('id')),
}).prepare('get_user');

const result = await prepared.execute({ id: 1 });
```

## Disambiguating Relations（消歧义）

当两张表之间有多条关系时，用 `relationName` 消歧：

```ts
// "多"的一边
export const usersRelations = relations(users, ({ many }) => ({
  author: many(posts, { relationName: 'author' }),
  reviewer: many(posts, { relationName: 'reviewer' }),
}));

// "一"的一边（必须配对相同的 relationName）
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id], relationName: 'author' }),
  reviewer: one(users, { fields: [posts.reviewerId], references: [users.id], relationName: 'reviewer' }),
}));
```

## Foreign Key Actions

在 `references()` 第二个参数指定：

```ts
userId: integer('user_id').references(() => usersTable.id, { onDelete: 'cascade' })
```

| Action | 效果 |
|---|---|
| `cascade` | 父行删除 → 子行也删除 |
| `no action` | 默认，有子行时禁止删父行 |
| `restrict` | 同 no action |
| `set null` | 父行删除 → 子行 FK 设为 NULL |
| `set default` | 父行删除 → 子行 FK 设为默认值 |

`onUpdate` 同理。

## Seed Data 的意义

Seed data 不是"演示数据"，是"压力测试用的真实量级数据"。只有 5 条记录时看不出性能问题，10 万条时才能暴露：
- `OFFSET 50000` 变慢 → 意识到需要 cursor-based 分页
- 没有 index 的 WHERE 全表扫描 → 去加 index
- JOIN 的 N+1 问题暴露 → 优化为批量查询

目的：在开发阶段就感受到真实数据量下的性能瓶颈。
