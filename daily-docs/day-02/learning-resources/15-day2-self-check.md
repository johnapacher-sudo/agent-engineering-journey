# Day 2 卡点思考与自检

## 卡点思考

### 1. `posts_tags` 的主键怎么设？单独 id 还是 `(postId, tagId)` 复合？

选复合主键 `(postId, tagId)`。

| | 复合主键 `(postId, tagId)` | 单独 id |
|---|---|---|
| 去重 | 自动保证，插入重复直接报错 | 需要额外加 UNIQUE 约束 |
| JOIN 性能 | 好，FK 本身就是主键的一部分 | 多一层索引查找 |
| 代码复杂度 | 少一张表的维护负担 | 多一个 id 字段，但没什么实际用处 |

单独 id 的话 `(postId=1, tagId=1)` 可以重复插入，复合主键天然去重。中间表用复合主键是标准做法。

### 2. seed 里写 insert 如果同一个 tag name 被插两次会怎样？怎么防？

如果该列有 `unique` 约束，重复插入会报错，PostgreSQL 错误码 23505（`unique_violation`）。

防护方式：

- **数据库层**：`text('name').unique()` — 最后一道防线
- **代码层**：先查再插，或者用 `onConflictDoNothing()` / `onConflictDoUpdate()`

```ts
db.insert(tagsTable)
  .values({ name: 'react' })
  .onConflictDoNothing();  // 有就跳过，不报错
```

### 3. migration 报错 "column cannot be added because it contains null values"？

原因：加了 NOT NULL 约束，但表中已有数据没有这个字段的值。

解决方案：

- 加 `default` 值让旧数据自动填充：`.notNull().default('customer')`
- 先不加 `notNull`，后期收紧约束
- 大表场景：分步 + 分批回填，避免锁表太久

核心原则：生产迁移永远不要让已有数据违反新约束。

---

## 今天结束能回答

### 1. 为什么 `(userId, status)` 索引能加速 `WHERE userId=? AND status=?`，但对 `WHERE status=?` 单独查询几乎没用？

复合索引的 B-tree 是**先按 userId 排序，userId 相同的再按 status 排序**：

```
userId=1, status='draft'
userId=1, status='published'
userId=2, status='draft'
userId=3, status='published'
```

- `WHERE userId=?` → 直接定位到 userId 那一段，快
- `WHERE userId=? AND status=?` → 先定位 userId，再在那一小段里找 status，更快
- **`WHERE status=?`** → status 的值散落在各个 userId 分组里，索引无法跳着找，等于全扫一遍

这叫**最左前缀原则**：复合索引只能从左到右连续使用，跳过左边的列就无法利用索引。

### 2. Drizzle 的 `relations()` 没有外键也能工作吗？DB 外键是干嘛用的？

**`relations()` 不依赖外键，两者完全独立。**

| | Foreign Key | Relations |
|---|---|---|
| 哪一层 | 数据库层 | 应用层 |
| 干什么 | 保证数据完整性（插/删时检查） | 告诉 Drizzle 怎么做 JOIN |
| 不加 FK，relations 能用吗 | 能 | — |

relations 里的 `fields` 和 `references` 只是告诉 Drizzle "用哪两列做关联查询"，不会在数据库建任何东西。

### 3. `pgEnum` 和 `text().$type<'draft' | 'published'>()` 各自什么时候选？迁移成本差异？

| | `pgEnum` | `text().$type<>()` |
|---|---|---|
| 数据库层 | 创建真实的 enum 类型 | 就是 text，数据库无感 |
| TS 类型 | 有类型推导 | 有类型约束 |
| 加枚举值 | 需要迁移 `ALTER TYPE ... ADD VALUE` | 改代码就行，零迁移 |
| 数据校验 | 数据库拒绝非法值 | 只有 TS 编译时检查，运行时可以插任意字符串 |

选型建议：值稳定不怎么变（比如 order status）→ `pgEnum`；值经常变或者只是 TS 侧想约束 → `text().$type`。
