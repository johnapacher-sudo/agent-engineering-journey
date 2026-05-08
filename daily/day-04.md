# Day 4 · 2026-05-11（周一）

> Week 1 · Postgres + Drizzle
> 今天 2-2.5h

## 今天学什么

**主题**：复杂查询的三样武器 —— filter、分页、事务。

CRUD 能跑通不算会数据库。真正的工程能力在这三件事：**用组合条件 filter（带 join）、做不崩的分页（cursor-based）、写跨表的原子操作（transaction）**。Agent 应用里几乎每个场景都会遇到这三样（memory 检索、chat 历史翻页、多步 tool call 的原子提交）。

## 核心概念

- **Offset pagination 的崩塌**：`LIMIT 20 OFFSET 10000` 在大表上要扫过 10020 行扔掉前 10000 行。流量大一点就被打死。Twitter、GitHub、Stripe 全部用 cursor。
- **Cursor pagination 本质**：用"上一页最后一行的 sort key"当下一页起点。`WHERE createdAt < $lastCreatedAt ORDER BY createdAt DESC LIMIT 20`。前提是 sort 列有索引、是稳定单调的。
- **Drizzle 的 `with`**：`db.query.posts.findMany({ with: { author: true, tags: true } })` —— Drizzle 帮你自动 join 并组装嵌套对象。但你要**看懂它在底层生成的是什么 SQL**（一次 JOIN 还是多次 query？）。
- **Transaction 的 ACID**：
  - **A**tomic：一组操作要么全成功要么全失败
  - **C**onsistent：事务后数据库约束仍然满足（外键、唯一等）
  - **I**solated：并发事务互不干扰（默认 READ COMMITTED）
  - **D**urable：commit 后即使断电也不丢
  - 今天用前两个就够，I/D 是 DB 保证的
- **为什么要看 raw SQL**：ORM 的抽象层越厚，你越不知道它"帮你做了什么"。慢查询、N+1、意外的 index 失效，**必须会读 raw SQL 才能 debug**。

## 参考资源

- **[Drizzle Relational Queries (with)](https://orm.drizzle.team/docs/rqb)** — 重点读 "How does it work" 段落
- **[Drizzle Transactions](https://orm.drizzle.team/docs/transactions)** — API 很薄，10 分钟搞定
- **[Cursor Pagination 设计](https://slack.engineering/evolving-api-pagination-at-slack/)** — Slack 工程博客，讲他们从 offset 迁到 cursor 的经历

## 动手练习

继续在 Day 3 项目上扩展 posts list：

1. **Filter**：list 页加两个 query param：`?status=published&tag=react`
   - Server component 读 `searchParams`，组装 Drizzle query 里的 `and(eq, eq, inArray)`
   - 注意 tag filter 需要 join `posts_tags` 表
2. **Cursor 分页**：
   - URL param：`?cursor=<publishedAt>`
   - query：`WHERE publishedAt < cursor ORDER BY publishedAt DESC LIMIT 20`
   - UI：list 底下放 "Next" 链接，href 带下一页的 cursor
   - **不要用 `page=1 page=2`**
3. **`with` 加载关联**：list 查询用 `db.query.posts.findMany({ with: { author: true, tags: true } })`，一次拿到 post + author.name + tags[]
4. **Transaction**：改 `createPost` 动作 —— 接收 `{ title, content, tagIds: [...] }`，在事务里：
   - insert post
   - insert 多条 posts_tags 关联
   - 如果某一条失败，整个回滚
5. **观察 raw SQL**：Drizzle 可以开 logger：
   ```ts
   drizzle(client, { logger: true })
   ```
   在 server 端 console 看每次查询的 SQL。重点看：
   - `with` 生成的是 JOIN 还是多次 SELECT？为什么？
   - filter 时索引有没有被用上？（这题 Day 6 精读时深入）

**卡点思考**：
- Cursor 分页如果 sort 列有重复值（两条 post 同一秒发布），怎么保证稳定分页？
- Transaction 里抛错会自动回滚吗？如果 `return` 而不是 `throw`，会怎样？
- `with` 如果你只要 author 的 `name` 字段，能否只 select 这一列？

## 今天结束能回答

- Cursor pagination 相比 offset 在 100 万行的表上性能差多少？为什么 offset 在前几页不慢、越往后越慢？
- Drizzle 的 `with: { author: true }` 生成的 SQL 是 `JOIN` 还是独立 `SELECT`？它为什么这么设计？
- 一个 transaction 里 `await db.insert(posts)...` 抛错，后续的 `await db.insert(posts_tags)...` 会执行吗？rollback 是谁触发的？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 5）上 Neon serverless driver —— 这是 Vercel + Neon 组合的关键适配
