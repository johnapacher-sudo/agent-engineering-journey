# Cursor-Based 分页

## Offset 分页及其问题

```sql
-- 第 1 页
SELECT * FROM messages ORDER BY created_at DESC LIMIT 20 OFFSET 0;
-- 第 2 页
SELECT * FROM messages ORDER BY created_at DESC LIMIT 20 OFFSET 20;
-- 第 5000 页
SELECT * FROM messages ORDER BY created_at DESC LIMIT 20 OFFSET 99980;
```

**两个缺陷**：

1. **数据偏移**：如果有新数据插入，翻到第 2 页时数据已偏移——出现重复或遗漏
2. **深翻页慢**：`OFFSET 100000` 数据库要扫描前 10 万行再丢掉，复杂度 O(offset + limit)

## Cursor-Based 分页

不用"跳过前 N 条"，而是记住"上一页最后一条的标记"（游标）：

```sql
-- 第 1 页
SELECT * FROM messages ORDER BY created_at DESC LIMIT 21;  -- 多取 1 条判断有没有下一页

-- 第 2 页：用第 1 页最后一条的 created_at 作为游标
SELECT * FROM messages
WHERE created_at < '2024-01-15 10:30:00'   -- 这就是 cursor
ORDER BY created_at DESC LIMIT 21;
```

Cursor = 一个定位锚点，"从这条记录往后取"。像一个书签，插在上一页最后一条的位置。

## 对比

| | Offset 分页 | Cursor 分页 |
|---|---|---|
| 翻到第 100 页 | `OFFSET 1980`，慢 | 直接用 cursor，一样快 |
| 有新数据插入 | 会错位（重复/遗漏） | 不受影响 |
| 能跳到任意页 | 能（`OFFSET 40` = 第 3 页） | 不能（只能上一页/下一页） |
| 适用场景 | 后台管理（要跳页） | 聊天滚动加载、Feed 流 |
| 性能（有索引） | O(offset + limit) | O(log N + limit) |

## 为什么 Cursor 快？

前提：cursor 字段有索引（如 `created_at` 上的 B-tree 索引）。

```
OFFSET 100000 LIMIT 20：
  → 数据库从索引头开始，走 100000 步，丢掉，再取 20 条
  → 复杂度 O(100000 + 20)

WHERE created_at < '2024-01-15' LIMIT 20：
  → 数据库用索引直接跳到 2024-01-15 那个位置（B-tree 查找，类似二分）
  → 往后取 20 条
  → 复杂度 O(log N + 20)
```

关键：cursor 的 WHERE 条件能命中索引直接跳转，而 OFFSET 必须逐行计数。但 **cursor 字段必须有索引**，没索引的话 WHERE 一样全表扫。

## 生产场景选择

| 场景 | 分页方式 | 原因 |
|---|---|---|
| 淘宝/京东商品列表 | Offset（但限制深度） | 用户要跳页 |
| 聊天记录向上滚动 | Cursor | 无限滚动，数据持续增长 |
| Twitter/朋友圈 Feed | Cursor | 按"上次看到哪条"续刷 |
| 后台管理表格 | Offset | 管理员要跳到任意页 |
| App 下拉刷新 | Cursor | 只需"比最新还新"的 |

## Cursor 锚点怎么定义

### 单字段锚点

```ts
// 第 1 页请求
GET /api/messages?limit=20

// 响应返回数据 + cursor
{
  data: [...20条消息],
  nextCursor: "2024-01-15T10:30:00Z"  // 最后一条的 created_at
}

// 第 2 页请求：客户端把 cursor 传回来
GET /api/messages?limit=20&cursor=2024-01-15T10:30:00Z
```

### 复合锚点（处理排序值相同的情况）

```ts
// 两条消息的 created_at 完全一样？用 (created_at, id) 组合
db.select()
  .from(messages)
  .where(
    or(
      lt(messages.createdAt, cursorTime),
      and(
        eq(messages.createdAt, cursorTime),
        lt(messages.id, cursorId)
      )
    )
  )
  .orderBy(desc(messages.createdAt), desc(messages.id))
  .limit(20)
```

客户端不需要"知道"锚点怎么算——服务端返回 `nextCursor`（通常 base64 编码），客户端原样传回来就行。

## 深翻页优化方案

如果确实有深翻页需求（电商十几万页）：

| 方案 | 改动量 | 效果 | 适用 |
|---|---|---|---|
| 子查询先取 ID | 改一条 SQL | 提升 3-10 倍 | 万级以内 |
| WHERE 替 OFFSET | 改交互 | 彻底解决 | 能接受"上下页"而非跳页 |
| 搜索引擎（ES） | 加基础设施 | 毫秒级深翻页 | 十万级、有搜索需求 |
| 预计算 + Redis | 加缓存层 | 极致性能 | 排序规则固定、读多写少 |

### 子查询优化

```sql
-- 慢：OFFSET 扫描时要回表取完整行
SELECT * FROM products ORDER BY sales DESC LIMIT 20 OFFSET 100000;

-- 快：先只从索引里取 20 个 ID，再回表
SELECT * FROM products
WHERE id IN (
  SELECT id FROM products ORDER BY sales DESC LIMIT 20 OFFSET 100000
);
```

子查询只查 id，走覆盖索引，不用回表。拿到 20 个 id 后再查完整数据，只需回表 20 次。

### 预计算 + Redis

```
定时任务每小时：
  按销量排序取前 10 万条 → 写入 Redis 有序列表（ZSET）

用户请求第 5000 页：
  → 从 Redis ZSET 里 ZRANGE 取对应的 20 条 ID
  → 拿 ID 去数据库/缓存取详情
  → 不碰数据库的分页逻辑
```

实际上"十几万页展示"本身就是伪需求——用户不可能翻到第 10 万页。真正的解法不是优化深翻页，是用搜索和筛选让用户在前 10 页内找到东西。

## 复合 Cursor：排序字段 + ID（处理重复值）

当 sort 列有重复值（两条 post 同一秒发布），单用 `createdAt` 做 cursor 不够——会漏数据。

**两个方案都不完美**：
- 用 id 做 cursor：排序需求是"按时间"，id 递增和 createdAt 递增不一定一致
- 提高时间精度到 ms：缓解问题但没根治，高并发下同一毫秒仍可能重复

**生产标准做法：复合 cursor（排序字段 + id）**，id 当 tiebreaker：

```ts
db.select()
  .from(posts)
  .where(
    or(
      // 情况 1：时间比锚点早，肯定排在后面
      lt(posts.createdAt, cursorTime),
      // 情况 2：时间相同，用 id 继续往后排
      and(
        eq(posts.createdAt, cursorTime),
        lt(posts.id, cursorId)
      )
    )
  )
  .orderBy(desc(posts.createdAt), desc(posts.id))
  .limit(20)
```

**为什么 OR 是正确的**：它精确描述了"在复合排序 (createdAt DESC, id DESC) 中排在锚点之后"这个语义。

```
数据（按 createdAt DESC, id DESC 排序）：
id=7  createdAt=10:30:00  ← 第 1 页最后一条（锚点）
id=5  createdAt=10:30:00
id=3  createdAt=10:30:00
id=9  createdAt=10:29:55
id=2  createdAt=10:29:50

第 2 页 WHERE 条件验证：
  id=5, 10:30:00 → created_at < 10:30:00? ❌ → (created_at = 10:30:00 AND id < 7)? ✅ → 取
  id=3, 10:30:00 → 同上 ✅ → 取
  id=7, 10:30:00 → ❌ 且 ❌ → 不取（锚点本身）
```

`(createdAt, id)` 组合一定唯一（因为 id 是主键），客户端把最后一条的 `createdAt + id` 传回来即可。
