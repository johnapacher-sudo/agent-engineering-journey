# 16 · 复合索引的使用场景

## 一句话

**复合索引用于"多字段组合过滤或排序"的查询频繁出现时**。不强制唯一，纯粹为读性能。

和复合主键的区别：
- 复合主键 → 定"身份"（唯一 + 非空），顺带附送索引
- 复合索引 → 纯加速查询，可任意多个，无约束

---

## 三个最典型的触发场景

### 场景 1：两个字段组合过滤

"某用户的某状态订单"：

```sql
SELECT * FROM orders
WHERE user_id = 123 AND status = 'pending';
```

- 只有 `user_id` 单列索引 → 先筛 user=123 的 500 条，再**逐行**过滤 status
- 有复合索引 `(user_id, status)` → 直接定位到那 30 条

```typescript
index('idx_orders_user_status').on(t.userId, t.status),
```

### 场景 2：过滤 + 排序（生产最常用）

```sql
SELECT * FROM posts
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

复合索引 `(user_id, created_at)`：
- 按 user_id 段定位
- 段内 created_at 本身有序 → **连排序都省了**

```typescript
index('idx_posts_user_created').on(t.userId, t.createdAt.desc()),
```

没这个索引会看到执行计划里有 `Sort`（内存或磁盘排序），吃资源。

### 场景 3：时间窗口 + 类别

```sql
SELECT * FROM events
WHERE event_type = 'login'
  AND created_at BETWEEN '2026-05-01' AND '2026-05-10';
```

```typescript
index('idx_events_type_created').on(t.eventType, t.createdAt),
```

规则复用："等值在前，范围在后"。

---

## 最左前缀反向利用：一条索引覆盖多查询

```typescript
index('idx_posts_user_status_created').on(t.userId, t.status, t.createdAt),
```

| 查询 | 能用吗 |
|---|---|
| `WHERE user_id = ?` | ✅ |
| `WHERE user_id = ? AND status = ?` | ✅ |
| `WHERE user_id = ? AND status = ? AND created_at > ?` | ✅ |
| `WHERE status = ?` | ❌（跳过最左） |
| `WHERE user_id = ? AND created_at > ?` | 部分 |

**一条复合索引 ≈ 多条前缀索引效果**，省磁盘省写入。

---

## 复合索引 vs 多个单列索引

| | 多个单列索引 | 一个复合索引 |
|---|---|---|
| `WHERE a = ?` | 快 | 快（最左） |
| `WHERE a = ? AND b = ?` | 慢（bitmap AND） | **最快** |
| `WHERE b = ?` | 快 | 慢（用不上） |
| 磁盘占用 | 两份 | 一份 |
| 写入开销 | 两份 | 一份 |

**两个条件总是一起查 → 复合索引**。
**经常单独查某一列 → 单列索引**。

---

## 什么时候该加复合索引的判断流程

**先别急着加**，按流程：

1. 列出业务上最高频的 5 条查询 SQL
2. 运行 `EXPLAIN` 看执行计划，有没有 `Seq Scan` 或 `Sort`
3. 找瓶颈列组合（多条件 AND、过滤+排序）
4. 按"等值在前、范围在后、选择性高在前"排列
5. 建索引，再 `EXPLAIN` 验证用上了

**反模式**：一上来给每个字段加索引。后果是写入慢、磁盘炸、优化器选错。

---

## Day 2 阶段要不要关心？

**基本不需要自己建**。当前范围内：

- 实体表 → PK 索引 DB 自带
- UNIQUE 字段 → 附送唯一索引
- 外键字段 → 手动加单列索引
- 关联表 → PK 复合索引附送，只需给第二列补

**开始关心复合索引的时机**：
- 出现"列表页/过滤页"，查询带多个条件
- `EXPLAIN` 看到 `Seq Scan on large_table`
- 某 API 慢到肉眼可见

---

## Day 2 posts 表的实战例子

```sql
-- 用户首页："我发的草稿"
SELECT * FROM posts
WHERE user_id = 1 AND status = 'draft'
ORDER BY created_at DESC;

-- 公开时间线："最近发布"
SELECT * FROM posts
WHERE status = 'published'
ORDER BY created_at DESC LIMIT 20;
```

合理配置：

```typescript
export const posts = pgTable('posts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status').notNull().$type<'draft' | 'published'>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  title: text('title').notNull(),
  content: text('content').notNull(),
}, (t) => [
  // 查询 1：user + status + 排序
  index('idx_posts_user_status_created').on(t.userId, t.status, t.createdAt.desc()),
  // 查询 2：status + 排序
  index('idx_posts_status_created').on(t.status, t.createdAt.desc()),
]);
```

两条复合索引精准覆盖两个查询模式。

---

## 总结

复合索引核心场景 = "两个以上字段经常一起出现在 WHERE / ORDER BY"。

三种触发：
1. 多字段组合过滤
2. 过滤 + 排序（**最常用**）
3. 时间窗口 + 类别

Day 2 不用自己建。真遇到慢查询、`EXPLAIN` 定位后再加。
