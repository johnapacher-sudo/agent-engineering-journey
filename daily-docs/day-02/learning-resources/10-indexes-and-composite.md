# 10 · 索引与复合索引

## 什么是索引

**索引 = 为加速查询，DB 额外维护的一份"排序好的查找结构"**（通常是 B-Tree）。

类比：
- 书没目录 → 一页页翻
- 书有目录 → 直接跳到指定章节

**代价**：占磁盘空间，INSERT/UPDATE 时要同步更新索引，所以不是字段越多越好，挑**查询频繁**的字段建。

## Drizzle 写法

```typescript
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name'),
  age: integer('age'),
}, (t) => ({
  nameIdx: index('users_name_idx').on(t.name),   // 单列索引
}));
```

## 复合主键 vs 复合索引（两个概念别混）

| | 复合主键 | 复合索引 |
|---|---|---|
| 主要目的 | 定义唯一身份 | 加速查询 |
| 约束数据 | 唯一 + 非空 | 不约束（除非加 UNIQUE） |
| 数量 | 一张表 1 个 | 任意多个 |
| 必需吗 | 每张表都要有主键 | 按需加 |

**交集**：复合主键**免费附送**一个复合索引。所以 `posts_tags` 用 `WHERE post_id=? AND tag_id=?` 查询很快，不用额外建。

## 复合索引的核心性质：顺序决定一切

### 电话簿类比

电话簿按 (姓, 名) 排序：

```
张 · 三
张 · 四
李 · 五
王 · 六
```

| 查询 | 效果 |
|---|---|
| "姓张的有谁" | ✅ 极快 |
| "姓张且叫三的" | ✅ 极快 |
| "叫三的（不限姓）" | ❌ 慢如扫全表 |

**关键**：电话簿是"先按姓、再按名"排的。**只有当查询涉及"最左边的字段"时，索引才起作用**。

### 数据库同理：最左前缀原则

复合索引 `(A, B, C)` 只在查询包含"最左边若干字段"时生效。

索引 `(userId, status)`：

```
userId  status
1       active
1       banned
2       active
2       pending
3       active
```

| 查询 | 能用这个索引吗 |
|---|---|
| `WHERE userId = 1` | ✅ |
| `WHERE userId = 1 AND status = 'active'` | ✅（完美命中） |
| `WHERE status = 'active'` | ❌（status 分散在各 userId 下） |

## 两条排序规则

### 规则 1：等值条件在前，范围条件在后

**原因**：等值条件把索引锁在一个点上，后面字段依然有序；范围条件把索引变成区间，区间内后面字段就乱了。

例子：

```
WHERE status = 'active' AND age > 25

→ 索引应该是 (status, age)  ✓
  先定位 status='active' 段，段内 age 有序，二分找 > 25

→ 索引如果是 (age, status)  ✗
  age > 25 的段里 status 乱序，status 用不上
```

### 规则 2：选择性高的在前

**选择性（selectivity）** = 一个字段能把数据切得多碎。
- `email` 高（每行不同，查一个值只剩 1 行）
- `gender` 低（查一个值还剩一半）

原则：如果你**总是两个条件一起查**，选择性高的放前面最优。

**例外**：如果经常只查低选择性字段（如 "所有 banned 用户"），反而要把它放前面 —— 否则单独查它用不上索引。

**真实场景：查询模式决定索引顺序，不是反过来。**

## Drizzle 复合索引写法

```typescript
export const orders = pgTable('orders', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (t) => ({
  userStatusIdx: index('idx_orders_user_status').on(t.userId, t.status),
  statusDateIdx: index('idx_orders_status_created').on(t.status, t.createdAt),
}));
```

一张表可以有多个复合索引，针对不同查询场景各设一个。

## 容易混的点：索引 vs 约束

| | 约束（constraint） | 索引（index） |
|---|---|---|
| 作用 | 保证数据**合法**（唯一、非空、外键等） | 加速**查询** |
| 例子 | `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `NOT NULL` | `CREATE INDEX ...` |
| 有附带索引吗 | PK 和 UNIQUE 自动建索引；**Postgres 的外键不自动建** | — |

**生产常见优化点**：Postgres 外键不自动建索引，所以按外键字段查询常需要手动加索引：

```typescript
userIdIdx: index('idx_posts_user_id').on(t.userId),
```

## 当下学习阶段的态度

**Day 2 不用深入索引**。先把主键/外键/关联表扎实，索引是查询变慢时再回来补的后话。知道它是"加速查询的额外结构"、"顺序决定能加速哪些查询"就够。
