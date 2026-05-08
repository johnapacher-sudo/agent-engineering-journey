# Day 6 · 2026-05-13（周三）

> Week 1 · Postgres + Drizzle
> 今天 2-2.5h · **阶段 2 精读日**

## 今天学什么

**主题**：把过去 5 天"跑通"的东西沉淀成"能讲清"的心智模型。

这是 roadmap 里明确定义的 **阶段 2 日**（会选）。前 5 天是阶段 1（会用），今天要把 Drizzle 和 Postgres 从"能用"升级到"遇到选型问题能判断、遇到性能问题能定位方向"。

**今天不写新功能**。只做三件事：读文档、写 raw SQL、记笔记。

## 核心概念

今天要建立的 5 个稳固知识点：

1. **Drizzle 的完整 DSL 面貌**：不只是 `select` / `insert`，还有 window function、CTE、`sql` template literal、prepared statements。
2. **索引的选择性和执行计划**：什么叫"high cardinality column"、为什么查询计划不走索引、`EXPLAIN ANALYZE` 怎么读（今天先接触，M5 Week 18 深挖）。
3. **`sql` template literal 的用法**：当 query builder 表达不了时（window function、复杂 CTE），用原生 SQL 模板，但保持类型安全。
4. **Prepared statements**：Drizzle 的 `.prepare()` 能把 query plan 缓存住，高频查询能省一笔。什么场景值得用。
5. **`onConflict` 家族**：`onConflictDoNothing` / `onConflictDoUpdate` = Postgres 的 `ON CONFLICT` 语法 = "upsert"。Agent 场景里（de-dup memory、rate limit record）很常用。

## 参考资源

今天主要在读，按这个顺序：

- **[Drizzle: Column types](https://orm.drizzle.team/docs/column-types/pg)** — 15 min 扫完，知道每个类型对应 Postgres 什么
- **[Drizzle: Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints)** — 20 min 读
- **[Drizzle: SQL template](https://orm.drizzle.team/docs/sql)** — 10 min
- **[Drizzle: Prepared statements](https://orm.drizzle.team/docs/perf-queries)** — 10 min
- **[Drizzle: Relations 再读](https://orm.drizzle.team/docs/rqb)** — 从头再读一遍，带着这几天的经验看会有新 aha
- **[Use the Index, Luke! 整站](https://use-the-index-luke.com/)** — Ch 1-3 精读（大概 30 min），这是 Postgres 索引的圣经

## 动手练习

打开 Neon 的 SQL Editor（不是 Drizzle Studio），今天写**原生 SQL**，目的是让你直接感受 Postgres 的能力边界：

1. **分组聚合**：按 `status` 分组，算每组 post 数量 + 最新一条的 publishedAt
   ```sql
   SELECT status, COUNT(*), MAX(published_at) FROM posts GROUP BY status;
   ```

2. **Window function**：每个 user 最新 3 条 post
   ```sql
   SELECT * FROM (
     SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY published_at DESC) as rn
     FROM posts
   ) t WHERE rn <= 3;
   ```
   然后用 Drizzle 的 `sql` template 写一遍等价版本。

3. **多对多反向聚合**：tag 维度每个 tag 有多少 post，返回 top 10
   ```sql
   SELECT t.name, COUNT(pt.post_id) as cnt
   FROM tags t
   JOIN posts_tags pt ON pt.tag_id = t.id
   GROUP BY t.name
   ORDER BY cnt DESC
   LIMIT 10;
   ```

4. **一次 JOIN 返回嵌套结构**：post + author.name + tags 数组（用 `json_agg`）
   ```sql
   SELECT p.*, u.name as author_name,
     json_agg(t.name) as tags
   FROM posts p
   LEFT JOIN users u ON u.id = p.user_id
   LEFT JOIN posts_tags pt ON pt.post_id = p.id
   LEFT JOIN tags t ON t.id = pt.tag_id
   GROUP BY p.id, u.name;
   ```
   对比 Drizzle 的 `with` 生成的 SQL，哪个更高效？

5. **按条件删除**：删除所有 status=draft 且创建超过 30 天的 post
   ```sql
   DELETE FROM posts WHERE status = 'draft' AND created_at < NOW() - INTERVAL '30 days';
   ```

6. **看一次 `EXPLAIN ANALYZE`**：挑一个 Day 4 的 filter 查询，在 Neon SQL Editor 里前面加 `EXPLAIN ANALYZE`，看输出。重点看 `Seq Scan` vs `Index Scan` 出现在哪。**看不懂没关系**，只要认出这两个关键词就行，M5 Week 18 深挖。

## 输出笔记

在 `notes/drizzle-cheatsheet.md` 里记下：

- Drizzle 常见模式速查（select / insert / update / delete / upsert / join / transaction）
- 什么场景用 query builder、什么场景用 `sql` template
- Postgres 索引直觉 3 条（单列 vs 复合、选择性、等值 vs 范围）
- 你今天学到的**一个反直觉的事实**（例：`EXPLAIN` 里 Planning Time 有时比 Execution Time 长）

## 今天结束能回答

- Drizzle 的 `prepared` 能省什么？每次查询 Postgres 做 3 件事：parse / plan / execute，prepared 省哪一步？
- 什么时候 `sql` template literal 比 query builder 更合适？（想出 3 个具体场景）
- `INSERT ... ON CONFLICT DO UPDATE` 在什么 agent 场景下特别有用？

## 晚上 10 min

- `journal.md`：今天不是动手日，记"**最打动你的一个概念**"
- commit `notes/drizzle-cheatsheet.md`
- 明天 Day 7 是 Week 1 收官 + 周复盘 —— 不加新东西，只验收
