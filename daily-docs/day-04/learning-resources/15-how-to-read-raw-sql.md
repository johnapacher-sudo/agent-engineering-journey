# 如何阅读 Raw SQL 日志

## 为什么要看

ORM 的抽象层越厚，你越不知道它"帮你做了什么"。慢查询、N+1、意外的 index 失效，必须会读 raw SQL 才能 debug。

## 第一步：去掉 params，只看骨架

原始日志：
```
Query: insert into "users_table_3" ("id", "user_name", "email", "password", "created_at", "updated_at") values (default, $1, $2, $3, default, default) returning "id", "user_name", "email", "password", "created_at", "updated_at" -- params: ["1111", "123@qq.com", "1234412"]
```

精简后：
```sql
INSERT INTO users (user_name, email, password) VALUES (...)
RETURNING id, user_name, email, password, created_at, updated_at
```

**始终先去掉 params，只看 SQL 结构。**

## 第二步：识别事务边界

```
begin                              ← 事务开始
  INSERT INTO users ...
  INSERT INTO posts ...
  INSERT INTO tags ... ON CONFLICT DO UPDATE ...
  INSERT INTO posts_tags ... ON CONFLICT DO NOTHING
commit                             ← 事务结束
```

一个事务里做了 4 步：建用户 → 建文章 → 建标签（存在就更新）→ 关联文章和标签（已存在跳过）。

## 第三步：从单条 SQL 里读出意图

以 tags 的 upsert 为例：

```sql
INSERT INTO tags (name, created_at, updated_at)
VALUES
  ('react'), ('vue'), ('golang')
ON CONFLICT (name) DO UPDATE SET
  name = excluded.name,
  updated_at = $4
RETURNING id, name, created_at, updated_at
```

三层意思：
1. **批量插入**：一次插 3 条（不是循环 3 次 INSERT，性能好）
2. **ON CONFLICT**：name 唯一冲突时不报错，改成更新（upsert）
3. **RETURNING**：返回完整行，Drizzle 拿到 id 给下一步关联用

## 你需要找的异常信号

| 信号 | 长什么样 | 说明 |
|---|---|---|
| N+1 问题 | 同一条 SELECT 重复出现 20 次 | 循环里逐条查，应该改成批量 |
| 意外全表扫描 | 没有 WHERE 的 SELECT | Drizzle 写漏了条件 |
| 事务太长 | begin 和 commit 之间有几十条 SQL | 事务持有锁太久，影响并发 |
| 缺少批量 | 连续 10 条 INSERT 单条插入 | 应该合并成一条批量 INSERT |

## 学习建议

不用单独"学看日志"。后面每做一次练习，花 30 秒扫一眼 log 的 `begin...commit` 里有多少条 SQL、有没有重复的模式，就够了。

另外可以用 `.toSQL()` 单独看某条查询生成的 SQL：

```ts
db.select().from(users).where(eq(users.id, 42)).toSQL();
// → { sql: 'SELECT * FROM "users" WHERE "id" = $1', params: [42] }
```

## SQL 基础要不要专门补？

不需要系统学。建议：
1. 主线继续推进，遇到不懂的 SQL 概念当场搞懂
2. 用 `.toSQL()` 看 Drizzle 生成了什么
3. 如果后续做到 M5（RAG 系统）或 M3（支付系统）发现 SQL 跟不上，再针对性补那块
