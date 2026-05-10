# 14 · 关联表的索引策略

## 核心结论

**关联表的复合主键会自动附送一个复合索引，按最左前缀原则只需给"非最左列"单独补索引**。

---

## 推导过程

### 有什么索引

```typescript
primaryKey({ columns: [t.postId, t.tagId] })
```

这个复合主键自动附送：

```sql
CREATE UNIQUE INDEX ... ON posts_tags (post_id, tag_id);
```

列顺序是 `(post_id, tag_id)` —— 按声明顺序来。

### 真实查询模式

关联表有两类反向查询：

| 查询 | SQL | 能用 PK 附送索引吗 |
|---|---|---|
| "post=1 有哪些 tag" | `WHERE post_id = 1` | ✅ 能（最左字段） |
| "tag=3 被哪些 post 贴过" | `WHERE tag_id = 3` | ❌ 不能（跳过最左） |

复合索引 `(post_id, tag_id)` 像电话簿"姓在前、名在后"。按姓查快，按名查等于扫全表。

### 结论

- **post_id 单独查询** → PK 附送索引覆盖 → 不用再加
- **tag_id 单独查询** → PK 附送索引用不上 → 必须单独加

### 正确写法

```typescript
export const postsTagsTable = pgTable('posts_tags', {
  postId: integer('post_id').notNull()
    .references(() => postsTable.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull()
    .references(() => tagsTable.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.postId, t.tagId] }),
  index('idx_posts_tags_tag_id').on(t.tagId),   // 只加这一个
]);
```

---

## 避免冗余

**不要给最左列再加单独索引**：

```typescript
// ❌ 冗余
index('idx_posts_tags_post_id').on(t.postId),   // PK 复合索引已覆盖

// 结果：浪费磁盘 + 写入要多维护一份索引 + 优化器可能乱选
```

---

## PK 列顺序的选择

| 查询模式 | PK 顺序建议 | 额外索引 |
|---|---|---|
| 两边查询频率差不多 | 随便选一个 | 给另一个加索引 |
| "按 post 查 tag" 远多于 "按 tag 查 post" | `(post_id, tag_id)` | 反向查少可以不加 |
| 两边都频繁查 | 都得有 | **都要保证被索引覆盖** |

惯例"让高频查询在前"。但关联表反向查询往往两边都常见，**稳妥做法：PK 顺序任意 + 给第二列单独加索引**。

---

## 修正认知：外键加索引不是"总要加"

笔记 12 里说"Postgres 外键不自动建索引，生产要手动加"。准确版本是：

> **每个外键字段都应该被某个索引覆盖（可以是复合索引的最左前缀），不一定要单独建。**

关联表里 `post_id` 作为 PK 最左已经被覆盖，不用再加。

---

## 判断流程

拿到一张表：

1. 列出所有"按 XX 查"的真实查询模式
2. 看看现有索引（包括 PK、UNIQUE 附送的）能覆盖哪些
3. 没覆盖的 → 加新索引
4. 完全重复覆盖的 → 不加

对 `posts_tags`：

```
查询模式：
  WHERE post_id = ?           ← PK 复合索引覆盖 ✓
  WHERE tag_id = ?            ← 未覆盖，需加
  WHERE post_id AND tag_id    ← PK 完美命中 ✓

结论：加一个 index on (tag_id) 就够
```
