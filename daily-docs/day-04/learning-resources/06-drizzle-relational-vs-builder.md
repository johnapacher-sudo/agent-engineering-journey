# 06 · Drizzle 两套查询 API：Relational vs Builder

> 上下文：写 day-04 demo 的 user list 时困惑「为什么 `db.select().leftJoin()...` 返回的是 `users_table_3` 这种命名空间字段，跟 schema 推导出来的扁平类型不一样」。背后是 Drizzle 故意的 API 分层。

---

## 一句话区分

| API | 入口 | 输出形状 | 设计目标 |
|---|---|---|---|
| **Relational Query** | `db.query.X.findMany({ where, with })` | 嵌套实体树 | 拿"实体 + 关联"，无 row explosion |
| **Builder** | `db.select().from().leftJoin().where()` | 扁平 SQL row（按表名分组） | 写任意复杂 SQL，可控、可优化 |

**两套 API 不是替代关系，是嵌套关系**——可以在 Relational 的 `where` 里塞 Builder 构造的 subquery。

---

## Relational Query API

### 形状

```ts
const result = await db.query.usersTable.findMany({
  where: eq(usersTable.id, 1),
  with: {
    posts: {
      where: eq(postsTable.status, 'published'),
      with: {
        tagsGroup: {
          with: { tag: true },
        },
      },
    },
  },
});

// result 类型：
// Array<{
//   id, userName, email, ...,
//   posts: Array<{
//     id, title, status, ...,
//     tagsGroup: Array<{
//       postId, tagId,
//       tag: { id, name, ... }
//     }>
//   }>
// }>
```

### 特性

1. **入口必须是某张表**（`db.query.X`），从这张表出发取关联
2. **`with` 只能走 schema 里 `relations()` 声明过的关系**
3. **每一层的 `where` 只过滤"自己这一层"**——不会自动级联到父/子层
4. **输出自动嵌套去重**——一个 user 不会因为有 5 篇 post 就出现 5 次

### 适用场景

- 列表 + 详情页（"取一个 user + 它的全部 post + 每篇 post 的全部 tag"）
- 任何"取实体 + 它的关联"的 80% 业务读场景

### 不适用场景

- 复杂聚合（COUNT / GROUP BY / HAVING）→ 用 Builder
- 跨表反向筛（"按关联表字段筛主表"）→ 在 `where` 内嵌 subquery（见下一节）

---

## Builder API

### 形状

```ts
const rows = await db
  .select()
  .from(usersTable)
  .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
  .leftJoin(tagsTable, /* ... */)
  .where(/* 任意 SQL 表达式 */);

// rows 类型：
// Array<{
//   users_table_3: { id, userName, email, ... },
//   posts_table_3: { id, title, ... } | null,
//   tags_table_3: { id, name, ... } | null,
// }>
```

注意：

1. **字段被 SQL 表名 namespace 包起来**（`users_table_3`、`posts_table_3`）——因为 join 后多张表可能有同名列（如都有 `id`）
2. **`leftJoin` 让右表字段为 `T | null`**——左表行没匹配右表时整体为 null
3. **存在 row explosion**：1 个 user 有 5 篇 post 每篇 10 个 tag → 50 行，user 字段重复 50 次

### 适用场景

- 复杂聚合查询、统计报表
- 自定义 JOIN 策略、CTE、UNION
- 需要绝对控制 SQL 的场景（性能调优）

### 不适用场景

- 想直接拿"嵌套实体树"用 → 你需要自己 group + dedup

---

## 两套 API 如何组合

最常见的"反向筛 user"场景，用 **Relational 当外壳 + Builder 当 subquery**：

```ts
import { inArray } from 'drizzle-orm';

return db.query.usersTable.findMany({
  where: inArray(
    usersTable.id,
    // ↓ 这里是 Builder 构造的 subquery，会被嵌进外层 SQL 的 WHERE x IN (...)
    db
      .select({ id: postsTable.userId })
      .from(postsTable)
      .innerJoin(postsTagsTable, eq(postsTagsTable.postId, postsTable.id))
      .innerJoin(tagsTable, eq(tagsTable.id, postsTagsTable.tagId))
      .where(eq(tagsTable.name, 'react')),
  ),
  with: {
    posts: { with: { tagsGroup: { with: { tag: true } } } },
  },
});
```

**关键认知**：

> 「Relational query 不能反向筛」是误解。
> 准确说法：「Relational query 的 `with` 链不能反向筛，但 `where` 可以塞 subquery 实现反向筛」。

`db.query.X.findMany({ where })` 的 `where` 接受任意 `SQL` 表达式，包括 `inArray(col, db.select(...))`、`exists(...)` 等。

---

## 概念地图

```
                       Drizzle 查询能力图谱

+--------------------------------------------------------------+
|  Relational Query API:  db.query.X.findMany({ where, with }) |
|  ----------------------------------------------------------  |
|   • 入口：从 X 这张表出发                                     |
|   • 输出：树形（嵌套实体），无 row explosion                  |
|   • where: 接受任意 SQL 表达式 ←------+                      |
|   • with:  只能走 schema 里定义的 relations                   |
+---------------------------------------+---------------------+
                                         |
                                         |  这里可以塞 ▼
                                         |
+----------------------------------------+--------------------+
|  Builder API:  db.select().from().leftJoin().where()        |
|  ---------------------------------------------------------- |
|   • 任意 JOIN、子查询、union、CTE                            |
|   • 输出：扁平 row（带表名 namespace + row explosion）       |
|   • 既能独立用，也能嵌进 relational query 的 where           |
+-------------------------------------------------------------+

「反向筛」的实现 = relational 外壳 + builder 子查询
                   ↑                  ↑
                   拿树形结果          表达"必须满足某关联条件"
```

---

## 两套 API 的本质区别

| 维度 | Builder（`db.select`） | Relational（`db.query.X.findMany`） |
|---|---|---|
| 返回形状 | SQL 行（扁平 + 表名 namespace） | 实体树（嵌套 + 字段名干净） |
| Row 数 | 笛卡尔积（重复严重） | 主表行数（自动去重） |
| SQL 条数 | 1 条（big JOIN） | 通常 1 条（modern Drizzle 用 lateral + json_agg） |
| Filter 灵活度 | 任意 SQL | 受限于关系结构 + where 内可塞 subquery |
| 适合的产出 | 报表、聚合、CSV 导出 | 列表页、详情页、API 树形响应 |
| 类型推导 | 字段名 = 你 select 的 key | 字段名 = schema inferSelect |

---

## 一句话内化

> Drizzle 的两套 API 是**嵌套关系**，不是替代关系。
> Relational query 是「拿树形结果」的入口，Builder 是「写任意 SQL」的工具——
> **真正的姿势是 Relational 当外壳，Builder 当 where 子查询**。

---

## Muscle Memory 关联

- **第 7 项「正确的 Server Action」**：DB 查询是 server action 的核心动作之一，知道何时用哪套 API 是基本素养
- **跨 ORM 通用**：所有 ORM（Prisma、SQLAlchemy、TypeORM）都有"实体取数 vs 任意 SQL"两套接口的对偶——今天搞清 Drizzle 的，未来碰新 ORM 就只是套用同一心智模型

---

## 相关笔记

- [07 · 反向筛 user：subquery + inArray 模式](./07-reverse-filter-pattern.md)
- [08 · Type-safe filter 抽象](./08-type-safe-filter-abstraction.md)
