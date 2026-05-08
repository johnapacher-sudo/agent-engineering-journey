# Day 2 · 2026-05-09（周六）

> Week 1 · Postgres + Drizzle
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：关系建模和索引的工程直觉。

昨天只有一张 `users` 表是开胃菜。今天上 4 张表，让你感受真实 schema 设计里的取舍：**外键约束 vs 性能 / 索引该加在哪 / enum 用数据库枚举还是 TypeScript 字面量类型**。这些问题 agent 应用里反复出现（conversation 有 status、memory 有 tag、tool_call 有 error_kind）。

## 核心概念

- **关系三种形态**：
  - 一对多（user : posts）→ 多方加外键
  - 多对多（posts : tags）→ 独立关联表 `posts_tags`
  - 一对一：用 UNIQUE 约束（今天不涉及）
- **Drizzle `relations()` vs 数据库外键**：两个独立的东西。外键是 DB 层的完整性保证；relations 是 Drizzle 查询时"一次 load 关联数据"的便捷声明。**两个都要写**。
- **复合索引顺序**：`(userId, status)` 和 `(status, userId)` 不一样。规则是"等值条件在前，范围条件在后，选择性高的在前"。今天体感一次就够，Day 6 精读。
- **pgEnum vs TypeScript 字面量**：
  - `pgEnum('status', ['draft', 'published'])` → DB 层强约束，加值要 migration
  - `text().$type<'draft' | 'published'>()` → 只在 TS 层保证，DB 里是普通 text
  - Agent 应用里 status 变化频繁，倾向后者
- **Seed data 的意义**：不是为了"有数据看"，是为了让你后面写 query / 分页 / filter 时**有真实数据量感受性能**。

## 参考资源

- **[Drizzle Relations](https://orm.drizzle.team/docs/relations)** — 主要读，理解 `relations()` API
- **[Drizzle Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints)** — 看索引语法
- **[Use the Index, Luke! Ch.3](https://use-the-index-luke.com/sql/where-clause/the-equals-operator)** — 15 分钟，建立索引直觉（这个网站是 Postgres 索引圣经）

## 动手练习

在 Day 1 项目上扩展 schema：

1. 加 `posts` 表：`id / userId (fk) / title / content / status / publishedAt`
   - `status`：先用 TS 字面量类型，理解它的限制
2. 加 `tags` 表：`id / name (unique)`
3. 加 `posts_tags` 关联表：`postId / tagId` 复合主键
4. 加索引：
   - `users.email` UNIQUE
   - `posts.(userId, status)` 复合
   - `posts.publishedAt` 单列
5. 用 `relations()` 声明 user.posts / post.author / post.tags / tag.posts 四组关系
6. `pnpm add -D @faker-js/faker`
7. 写 `scripts/seed.ts`：清空再重建 → 10 user / 50 post / 20 tag / 每个 post 平均 1-3 个 tag
8. `package.json` 加 `"db:seed": "tsx scripts/seed.ts"`
9. `pnpm db:seed` 跑通
10. Drizzle Studio 看数据：`pnpm drizzle-kit studio`

**卡点思考**：
- `posts_tags` 的主键怎么设？单独 id 还是 `(postId, tagId)` 复合？各自代价？
- seed 里写 insert 如果同一个 tag name 被插两次会怎样？怎么防？
- migration 报错 "column cannot be added because it contains null values"？说明什么、怎么救？

## 今天结束能回答

- 为什么 `(userId, status)` 索引能加速 `WHERE userId=? AND status=?`，但对 `WHERE status=?` 单独查询几乎没用？
- Drizzle 的 `relations()` 没有外键也能工作吗？那 DB 外键是干嘛用的？
- `pgEnum` 和 `text().$type<'draft' | 'published'>()` 各自什么时候选？迁移成本差异？

## 晚上 10 min

- `journal.md` 3 行：aha / 疑问 / 想深挖
- commit & push
- 明天是 Server Actions CRUD，今天的 schema 就是舞台
