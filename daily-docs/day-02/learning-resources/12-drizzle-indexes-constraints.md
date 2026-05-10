# 12 · Drizzle Indexes & Constraints 全家福

> 读官方文档后的整理。按"约束（保证数据合法）+ 索引（加速查询）"两大类展开，
> 带上语法、生成的 SQL、使用场景。

## 总览：这两类东西到底是什么

```
约束（Constraints）  → 数据合不合法，DB 会拒绝非法数据
索引（Indexes）      → 查询快不快，DB 维护额外结构提速
```

两者独立但有交集：`PRIMARY KEY` 和 `UNIQUE` 约束会**自动附送一个索引**。

---

## 一、约束清单（7 种）

### 1. DEFAULT — 默认值

插入时没给值，用默认值填。

```typescript
import { pgTable, integer, uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const t = pgTable('t', {
  count:     integer('count').default(0),                   // 静态值
  id:        uuid('id').defaultRandom(),                    // 随机 UUID
  createdAt: timestamp('created_at').defaultNow(),          // 当前时间
  status:    text('status').default(sql`'pending'`),        // SQL 表达式
});
```

**生成 SQL**：`count integer DEFAULT 0`

**心智模型**：默认值是"应用层偷懒"的安全网 —— 列还在，但 INSERT 时可省略。

---

### 2. NOT NULL — 非空

列不允许 NULL。

```typescript
title: text('title').notNull(),
```

**心智模型**：业务语义上"必填"的字段永远加 `.notNull()`。外键字段经常也要加（除非业务允许"关联可选"）。

---

### 3. UNIQUE — 唯一

列（或列组合）的值不能重复。可以**多个 UNIQUE** 并存。

#### 单列 UNIQUE（字段级）

```typescript
email: text('email').unique(),
// 自定义约束名
email: text('email').unique('users_email_unique'),
```

#### 复合 UNIQUE（表级）

```typescript
const t = pgTable('t', {
  id: integer('id'),
  name: text('name'),
}, (t) => [
  unique().on(t.id, t.name),                      // (id, name) 组合唯一
  unique('custom_name').on(t.id, t.name),         // 带自定义名字
]);
```

#### Postgres 15+ 的 NULL 处理

默认 NULL ≠ NULL（两个 NULL 不算重复，能并存）。15+ 可以反过来：

```typescript
unique().on(t.id, t.name).nullsNotDistinct(),     // 两个 NULL 也算重复
```

**附送索引**：UNIQUE 约束会自动建一个**唯一索引**（加速 = 查询）。

**使用场景**：email、username、订单号、slug 这种"业务唯一键"。

---

### 4. CHECK — 业务规则

用 SQL 表达式校验字段。

```typescript
const users = pgTable('users', {
  age: integer('age'),
  email: text('email'),
}, (t) => [
  check('age_check1', sql`${t.age} > 21`),
  check('email_format', sql`${t.email} LIKE '%@%'`),
]);
```

**生成 SQL**：`CONSTRAINT age_check1 CHECK (age > 21)`

**心智模型**：比 enum 灵活（可以写任意布尔表达式），但改规则要 migration。
适合"灵活枚举 + DB 兜底"场景（见笔记 11）。

---

### 5. PRIMARY KEY — 主键

一张表最多 1 个。必须唯一 + 非空。

```typescript
// 字段级写法（单列主键）
id: serial('id').primaryKey(),
id: integer('id').primaryKey().generatedAlwaysAsIdentity(),    // 推荐
```

**附送索引**：PK 自动建复合索引（或单列索引）。

---

### 6. 复合主键 — 必须在表级

多字段组合作主键。关联表的标配。

```typescript
const booksToAuthors = pgTable('books_to_authors', {
  authorId: integer('author_id'),
  bookId: integer('book_id'),
}, (t) => [
  primaryKey({ columns: [t.bookId, t.authorId] }),
]);
```

**关键点**：
- 只能写在表级（回调参数里），不能挂在字段链式方法上
- 自动附送复合索引，按组合顺序排列
- 组合里的每一列自动 NOT NULL

---

### 7. FOREIGN KEY — 外键

引用另一张表的主键。

#### 字段级写法（常用）

```typescript
authorId: integer('author_id').references(() => users.id),

// 带级联行为
userId: integer('user_id').references(() => users.id, {
  onDelete: 'cascade',     // 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action'
  onUpdate: 'cascade',
}),
```

#### 表级写法（用于自引用或复合外键）

```typescript
// 自引用：parentId 指向本表的 id
const user = pgTable('user', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id'),
}, (t) => [
  foreignKey({
    columns: [t.parentId],
    foreignColumns: [t.id],
  }),
]);

// 复合外键：两列一起引用另一张表的复合主键
foreignKey({
  columns: [t.a, t.b],
  foreignColumns: [other.a, other.b],
}),
```

**不附送索引**：Postgres 外键**不自动建索引** —— 生产常见优化点，记得手动加：

```typescript
userIdIdx: index('idx_posts_user_id').on(t.userId),
```

---

## 二、索引清单

### 基础：普通索引 & 唯一索引

```typescript
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email'),
}, (t) => [
  index('name_idx').on(t.name),                 // 普通索引
  uniqueIndex('email_idx').on(t.email),         // 唯一索引
]);
```

`uniqueIndex` vs `unique()` 约束的微妙区别：
- `unique()` → 约束语义，SQL 里叫 `UNIQUE CONSTRAINT`
- `uniqueIndex()` → 索引语义，SQL 里叫 `UNIQUE INDEX`
- 实际效果基本一样（Postgres 底层都是 unique index），语义清晰度不同

### 复合索引

```typescript
index('user_status_idx').on(t.userId, t.status),
```

**最左前缀原则**：顺序至关重要。详见笔记 10。

---

## 三、PostgreSQL 索引高级选项（0.31.0+）

完整形态（组合使用）：

```typescript
index('idx_name')
  .on(t.col1.asc(), t.col2.nullsFirst())
  .concurrently()
  .where(sql`${t.status} = 'active'`)
  .with({ fillfactor: '70' })
```

### 选项 1：列的排序方向 `.asc() / .desc()`

```typescript
index('idx').on(t.createdAt.desc()),               // 倒序索引
index('idx').on(t.a.asc(), t.b.desc()),            // 混合顺序
```

**用途**：`ORDER BY created_at DESC` 查询能直接走索引，不用额外排序。

### 选项 2：NULL 顺序 `.nullsFirst() / .nullsLast()`

```typescript
index('idx').on(t.score.desc().nullsLast()),
```

Postgres 默认 ASC 的 NULL 在后，DESC 的 NULL 在前。显式声明覆盖默认。

### 选项 3：`.concurrently()` — 在线建索引

```typescript
index('idx').on(t.name).concurrently(),
```

**生产必备**：生成 `CREATE INDEX CONCURRENTLY`，不锁表。
常规 `CREATE INDEX` 会写锁全表，大表上锁住几分钟业务就挂了。

### 选项 4：`.where(...)` — 部分索引（Partial Index）

只给满足条件的行建索引。

```typescript
// 只为活跃用户的 email 建索引
uniqueIndex('active_email_idx')
  .on(t.email)
  .where(sql`${t.deletedAt} IS NULL`),

// 只为未完成订单建索引
index('pending_orders_idx')
  .on(t.userId)
  .where(sql`${t.status} = 'pending'`),
```

**价值**：
- 索引更小（磁盘省、内存省）
- 写入更快（大部分数据不进索引）
- 查询要带上对应条件才能用这个索引

### 选项 5：`.with(...)` — 存储参数

```typescript
index('idx').on(t.name).with({ fillfactor: '70' }),
```

调 B-Tree 填充因子等底层参数，大多数场景用不上。

### 选项 6：`.using(...)` — 索引方法

Postgres 支持多种索引结构：

```typescript
index('idx').using('btree', t.col),          // B-Tree（默认，通用）
index('idx').using('hash', t.col),           // Hash（只支持 =）
index('idx').using('gin', t.tags),           // GIN（数组、JSONB、全文搜索）
index('idx').using('gist', t.geo),           // GiST（地理、范围）
index('idx').using('brin', t.ts),            // BRIN（超大表的时序数据）
```

**速记**：
- 普通字段 → btree（默认不用写）
- JSONB / array 字段 → gin
- 地理 / 范围类型 → gist
- 亿级时序表 → brin

### 选项 7：函数索引（表达式索引）

索引不是字段本身，而是字段的变换：

```typescript
index('lower_email_idx').using('btree', sql`lower(${t.email})`),
```

用途：忽略大小写查 email 时能走索引（`WHERE lower(email) = 'a@x.com'`）。

---

## 四、MySQL & SQLite 的差异（简记）

### MySQL 特有选项

```typescript
index('name')
  .on(t.name)
  .algorithm('default')   // 'default' | 'copy' | 'inplace'
  .using('btree')         // 'btree' | 'hash'
  .lock('default')        // 'none' | 'default' | 'exclusive' | 'shared'
```

### SQLite / MSSQL

只支持基础的 `.where(sql\`...\`)`，不支持 concurrently / using 等。

---

## 五、快速决策速查表

| 需求 | 用什么 |
|---|---|
| "这列必填" | `.notNull()` |
| "这列不能重复" | `.unique()` 或 `uniqueIndex()` |
| "组合不能重复" | `unique().on(a, b)` |
| "这列要在某范围" | `check('name', sql\`...\`)` |
| "这列默认值" | `.default(...)` / `.defaultNow()` / `.defaultRandom()` |
| "表有主键" | `.primaryKey()` / `.generatedAlwaysAsIdentity()` |
| "关联表主键" | `primaryKey({ columns: [...] })` 表级 |
| "外键" | `.references(() => other.id, { onDelete: ... })` |
| "自引用外键" | 表级 `foreignKey({ ... })` |
| "加速某列查询" | `index('idx').on(t.col)` |
| "加速组合查询" | `index('idx').on(t.a, t.b)` |
| "加速 ORDER BY DESC" | `.on(t.col.desc())` |
| "只为部分行建索引" | `.where(sql\`...\`)` |
| "生产上给大表建索引" | `.concurrently()` |
| "JSONB / 数组字段查询" | `.using('gin', ...)` |
| "忽略大小写查 email" | `.using('btree', sql\`lower(...)\`)` |

---

## 六、三个最容易混淆的点

### 1. `unique()` 约束 vs `uniqueIndex()`

效果几乎一样（Postgres 底层都是 unique index）。语义上：
- `unique()` → 业务约束（"email 必须唯一"）
- `uniqueIndex()` → 性能 + 约束（"给 email 建唯一索引顺便加速查询"）

**通常用 `unique()` 字段级写法最简洁**，索引会自动附送。

### 2. 外键 **不自动** 带索引

常见坑：`posts.user_id` 是外键，你以为按 user 查 posts 很快 —— 其实没索引，扫全表。
**生产黄金规则**：给每个外键字段**手动加索引**。

```typescript
userIdIdx: index('idx_posts_user_id').on(t.userId),
```

### 3. `primary key` 和 `unique index` 都附送索引，但类型不同

- PK → B-Tree 索引（NOT NULL）
- UNIQUE → B-Tree 索引（允许 NULL，默认 NULL ≠ NULL）

两者都能加速"按该列等值/范围查询"。

---

## 七、对照当下阶段的优先级

读完这份索引，**Day 2 范围内你只需要用到**：

- ✅ `.notNull()`
- ✅ `.unique()`
- ✅ `.default()` / `.defaultNow()` / `.defaultRandom()`
- ✅ `.primaryKey()` / `.generatedAlwaysAsIdentity()`
- ✅ `primaryKey({ columns: [...] })` 复合主键
- ✅ `.references(() => ...)` 外键
- ✅ `index('...').on(...)` 基础索引
- ✅ `check('...', sql\`...\`)` 知道有这个就行，暂时不用

**暂时用不上但要记得存在**：

- ⏳ `.concurrently()` —— 真上生产时再加
- ⏳ `.where(...)` 部分索引 —— 优化阶段
- ⏳ `.using('gin')` —— JSONB / 全文搜索场景
- ⏳ `foreignKey({...})` 表级 —— 自引用/复合外键遇到再说

**心法**：先会"必要的 8 种"，其他作为"知道有这个工具"，真用到再查文档。
