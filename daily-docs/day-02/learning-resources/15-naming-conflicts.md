# 15 · 命名冲突会发生什么

## 一句话结论

**会报错**。两个重名的索引/约束冲突，`drizzle-kit migrate` 执行时数据库直接拒绝，迁移事务回滚。

---

## 场景重现

```typescript
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name'),
}, (t) => [
  index('users_pkey').on(t.id),   // ← 故意和 PK 附送索引同名
]);
```

PK 自动附送的索引默认叫 `users_pkey`（Postgres 命名规则 `<表名>_pkey`）。

跑 `drizzle-kit push` 或 `migrate`：

```
ERROR: relation "users_pkey" already exists
```

---

## 为什么：命名空间（namespace）概念

Postgres 里**索引、表、视图、序列** 共享同一个命名空间（relation namespace），同一 schema 下必须全局唯一。

| 对象类型 | 能同 schema 重名吗 |
|---|---|
| 表 和 表 | ❌ |
| 索引 和 索引 | ❌ |
| **表 和 索引** | ❌（很反直觉但共享命名空间） |
| 不同 schema 下 | ✅ |

所以理论上你不能建一张表叫 `users_pkey`（如果该索引已存在）。

### 约束的命名空间是另一套

约束有自己的命名空间，**在同一张表内**不能重名：

```typescript
(t) => [
  unique('xyz').on(t.a),
  check('xyz', sql`...`),   // ❌ 同表内约束名冲突
]
```

---

## 不同后果分类

### 两个都是索引

```typescript
uniqueIndex('users_pkey').on(t.email),   // 和 PK 附送的重名
// → relation already exists
```

### 索引 + 约束（unique 底层是索引）

```typescript
index('users_email_uq').on(t.email),
unique('users_email_uq').on(t.email),   // 约束会建同名索引 → 撞名
```

### Drizzle 是否提前校验？

**不能依赖 Drizzle 检查**。很多版本只负责把 TS 翻译成 SQL，语义校验靠 DB。有些版本能在 generate 阶段检测到，有些会放到 migrate 时才炸。

---

## PK 附送索引到底叫啥

**Postgres 默认**：`<表名>_pkey`

```sql
CREATE TABLE users (id SERIAL PRIMARY KEY);
-- 自动生成索引名：users_pkey
```

**Drizzle 自定义**：

```typescript
// 复合主键命名
primaryKey({ columns: [t.a, t.b], name: 'users_pk_custom' }),
```

---

## 误区：能不能给 PK 列再加一个索引加速？

**不能（技术上会重名报错），也没意义**。

- PK 附送的索引已经是 `(id)` B-Tree，`WHERE id = ?` 已是最快路径 O(log n)
- 再建索引是两份存同样数据，浪费磁盘 + 写入维护两份
- 优化器可能乱选

**没有任何场景需要给 PK 列单独再加索引**。

---

## 合法的"多索引指向同一列"

如果真有正当需求（不同排序/不同过滤）：

```typescript
(t) => [
  index('idx_users_id_asc').on(t.id.asc()),
  index('idx_users_id_desc').on(t.id.desc()),       // 不同方向
  index('idx_users_id_active').on(t.id)
    .where(sql`${t.deletedAt} IS NULL`),             // 部分索引
]
```

规则：**列可以相同，但索引属性必须不同，名字必须不同**。

---

## 如果真的重名卡住了

```bash
# 1. 改 schema.ts 改名
# 2. 删坏掉的 migration
rm drizzle/0003_bad_migration.sql
# 3. 重新生成
drizzle-kit generate
# 4. 应用
drizzle-kit migrate
```

Postgres migration 通常在事务里，失败整体回滚，DB 不会半坏。生产上踩到就按报错处理。

---

## 一句话总结

1. 重名 → `relation "xxx" already exists` → 迁移失败回滚
2. 原因：Postgres 里索引/表/视图共享命名空间
3. PK 自带索引默认 `<表名>_pkey`，不要撞
4. 给 PK 列单独加索引没意义（也会撞名）
