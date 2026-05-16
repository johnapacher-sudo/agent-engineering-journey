# Day 4 自检题校验记录

## 1. Cursor vs Offset 在 100 万行上的性能差距

**我的回答**：cursor 基于索引直接跳到某一行取 limit，offset 需要从第一行逐个扫到第 N 行。

**校验**：方向正确。补充量化数据。

Offset 成本 = O(offset 值)，线性增长：

| 页数 | Offset 耗时 | Cursor 耗时 | 差距 |
|---|---|---|---|
| 第 1 页（offset 0） | ~1ms | ~1ms | 一样 |
| 第 50 页（offset 1000） | ~5ms | ~1ms | 5x |
| 第 500 页（offset 10000） | ~50ms | ~1ms | 50x |
| 第 5000 页（offset 100000） | ~500ms | ~1ms | 500x |
| 第 5 万页（offset 1000000） | ~5s+ | ~1ms | 5000x+ |

关键点：
- **Offset 前 10 页跟 cursor 一样快**，跳过 200 行没什么成本
- **Cursor 恒定 O(log N)**：B-tree 索引二分查找 ≈ 20 次比较就跳到锚点
- Offset 的成本跟"跳过多少行"成正比，跟表大小无关

---

## 2. Drizzle `with: { author: true }` 生成 JOIN 还是独立 SELECT

**我的回答**：生成的 SQL 是 JOIN，是语法糖方便写跨表查询。

**校验：❌ 错误。生成的是独立 SELECT，不是 JOIN。**

```ts
db.query.posts.findMany({
  with: { author: true }
})
```

实际生成**两条独立查询**：

```sql
SELECT * FROM posts;
SELECT * FROM users WHERE id IN (1, 2, 3);
```

然后在 JS 内存里把 author 嵌套到对应的 post 上。

**为什么不用 JOIN？** 避免 JOIN row explosion：

```
1 个 user 有 100 篇 post，每篇 post 有 10 个 tag

JOIN 方式：1 × 100 × 10 = 1000 行，user 字段重复传输 1000 次
独立 SELECT：100 posts + 1 user（去重）+ tags → 远少于 1000 行
```

`with` 不是 JOIN 的语法糖，是"分批查询 + 内存组装 + 自动去重"策略。嵌套多层 with 时差距尤其明显。

---

## 3. Transaction 里某步抛错，rollback 是谁触发的

**我的回答**：不会执行后续操作，事务自动回退。

**校验**：结论正确，但"自动"不够精确。**是 Drizzle（driver 层）在 catch 里发的 ROLLBACK。**

```
执行流程：
1. Drizzle 发送 BEGIN 给 PG
2. 执行第一条 INSERT → 成功
3. 执行第二条 INSERT → PG 返回错误
4. Drizzle catch 到错误 → 发送 ROLLBACK 给 PG    ← Drizzle 触发的
5. Drizzle re-throw 错误给调用方

如果没有错误：
1. Drizzle 发送 BEGIN
2. 执行完所有操作
3. Drizzle 发送 COMMIT                        ← 同样是 Drizzle 触发的
4. 返回 callback 的 return 值
```

PG 本身不会自动 rollback——它只是在等下一条命令（COMMIT / ROLLBACK / 继续 SQL）。是 Drizzle 的 transaction wrapper 在 catch 里决定发 ROLLBACK 的。

---

## 错误反思

| 题目 | 我的答案 | 实际 | 教训 |
|---|---|---|---|
| `with` 生成什么 SQL | JOIN | 独立 SELECT | 不能凭直觉假设 ORM 行为，用 `.toSQL()` 或 logger 验证 |
| rollback 谁触发 | "事务自动的" | Drizzle driver 层 catch 后发 ROLLBACK | "自动"背后有具体机制，理解触发链路才能 debug |
| Cursor vs Offset 性能 | 方向对，缺量化 | 前几页几乎无差距，深翻页差 5000x+ | 量化意识——"慢"要多慢？ |
