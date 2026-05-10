# 13 · 约束/索引的命名规范

## 先补最基础的缩写

| 缩写 | 全称 | 中文 |
|---|---|---|
| PK | Primary Key | 主键 |
| FK | Foreign Key | 外键 |
| UQ / UK | Unique Key | 唯一约束 |
| idx | Index | 索引 |
| DB | Database | 数据库 |
| ORM | Object-Relational Mapping | 对象关系映射 |

以前笔记里出现的 "PK"、"FK"、"UQ" 都是这个意思。

---

## 核心概念：约束/索引是有名字的对象

关系数据库里每个约束、每个索引在 DB 里都是**独立的命名实体**，和表平级。

```sql
-- Postgres 查看所有约束
SELECT conname FROM pg_constraint;
-- users_email_unique
-- posts_user_id_fk
-- posts_pkey

-- 查看所有索引
\di
```

不传名字时 Drizzle 会自动生成一个（类似 `<表名>_<列名>_unique`）。

---

## 为什么要自定义名字：4 个真实场景

### 场景 1：错误信息里会出现这个名字

插入重复 email：

```
ERROR: duplicate key value violates unique constraint "users_email_unique"
```

前端要判断具体是哪条约束违反：

```typescript
if (err.constraint === 'users_email_uq') return { error: '邮箱已注册' };
if (err.constraint === 'users_phone_uq') return { error: '手机号已注册' };
```

硬编码自动生成的名字不稳（版本差异），显式命名更可靠。

### 场景 2：删除/修改要靠名字

```sql
ALTER TABLE users DROP CONSTRAINT users_email_uq;
DROP INDEX idx_orders_user_status;
```

不知道名字就没法操作。

### 场景 3：自动名太丑或太长

Drizzle 可能生成 `posts_tags_post_id_tag_id_posts_tags_post_id_tag_id_pk` 这种怪物。

### 场景 4：跨环境一致性

开发环境 Drizzle 生成的名字 vs 生产 DBA 手建的名字可能不一致，导致某些 migration SQL 在一边成功一边失败。

---

## 命名规范（行业惯例，团队统一即可）

### 索引：前缀 `idx_`

```
idx_<表名>_<列名>
idx_<表名>_<列1>_<列2>           -- 复合
idx_<表名>_<列>_<用途>            -- 特殊用途
```

```typescript
index('idx_posts_user_id').on(t.userId),
index('idx_orders_user_status').on(t.userId, t.status),
uniqueIndex('idx_users_email').on(t.email),
index('idx_posts_created_desc').on(t.createdAt.desc()),
```

### 约束：后缀 `_pk / _fk / _uq / _chk`

```typescript
primaryKey({ columns: [t.postId, t.tagId], name: 'posts_tags_pk' }),
unique('users_email_uq').on(t.email),
check('users_age_chk', sql`${t.age} >= 0`),
```

### 记忆口诀

```
索引 → 前缀 idx_
主键 → 后缀 _pk
外键 → 后缀 _fk
唯一 → 后缀 _uq
check → 后缀 _chk
```

---

## 不要混淆：回调 key vs 数据库名

```typescript
(t) => ({
  emailIdx: index('idx_users_email').on(t.email),
  //  ↑           ↑
  //  A           B
})
```

- **A = `emailIdx`** → **TS 对象 key**。只给自己看，Drizzle 不关心，数据库不知道。叫 `potato` 也行。
- **B = `'idx_users_email'`** → **数据库里的真名字**。`\d users` 能看到，`DROP INDEX` 能用。

这两个独立存在。前者是 TS 代码组织标识，后者是数据库对象名。

新版 Drizzle 支持返回数组 `(t) => [...]`，干脆省掉了对象 key。

---

## 实战建议

**写约束/索引时都显式传名字**，按规范命名。原因：

1. 强迫自己想"这个约束是干嘛的"
2. 生产级习惯，早养成比后面重构成本低
3. 报错信息看得懂
4. migration 里好操作

```typescript
// ❌ 懒写
email: text('email').unique(),
index().on(t.name),

// ✓ 清晰
email: text('email').unique('users_email_uq'),
nameIdx: index('idx_users_name').on(t.name),
```
