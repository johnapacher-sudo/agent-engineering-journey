# 07 · Migration 演化关系（后加多对多）

## 基本流程

Drizzle migration 就是为"表结构演进"而存在的。

```bash
# 1. 改 schema.ts（加中间表）
# 2. 生成迁移
drizzle-kit generate

# 3. 应用迁移
drizzle-kit migrate       # 生产
drizzle-kit push          # 开发快速迭代
```

## 纯增量改动最简单

第一版只有两张表：

```typescript
export const posts = pgTable('posts', { ... });
export const tags  = pgTable('tags',  { ... });
```

后来加中间表：

```typescript
export const postsTags = pgTable('posts_tags', {
  postId: integer('post_id').notNull().references(() => posts.id),
  tagId:  integer('tag_id').notNull().references(() => tags.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.tagId] }),
}));
```

`drizzle-kit generate` 生成：

```sql
CREATE TABLE "posts_tags" (
  "post_id" integer NOT NULL,
  "tag_id"  integer NOT NULL,
  CONSTRAINT "posts_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id"),
  CONSTRAINT "posts_tags_post_id_posts_id_fk"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id"),
  CONSTRAINT "posts_tags_tag_id_tags_id_fk"
    FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
);
```

原来的 posts 和 tags 表**一个字没改**，老数据完整保留。

`drizzle-kit migrate` 会执行这段 SQL，并把迁移记录到 `__drizzle_migrations` 元数据表里，下次不会重复。

## 不同演进场景的难度

| 场景 | 难度 | 坑 |
|---|---|---|
| 加一张新表（含中间表） | 极简单 | 无 |
| 加一列（可空） | 简单 | 无 |
| 加一列（非空） | 中等 | 要 default 或分两步 |
| 改列类型 | 中等 | 可能要先转换数据 |
| 删列 / 删表 | 中等 | 会丢数据 |
| 一对多改多对多 | 复杂 | 要写 data migration |

## 一对多改多对多（需 data migration）

假设原 posts 有 `tag_id`（一对多），改成多对多：

1. 新建 `posts_tags` 表（generate 自动生成）
2. **手动写 SQL** 搬数据：
   ```sql
   INSERT INTO posts_tags (post_id, tag_id)
   SELECT id, tag_id FROM posts WHERE tag_id IS NOT NULL;
   ```
3. 删掉 `posts.tag_id` 列

Drizzle 的 generate 能自动生成第 1 步和第 3 步的 SQL，**但第 2 步它不知道你要搬哪些数据，得你手动加到迁移文件里**。

生产上通常拆成三次部署：
- 先加新表 + 双写
- 回填数据
- 再去旧列

## push vs generate+migrate

- **开发阶段**：`drizzle-kit push` 即时改数据库，适合本地快速迭代
- **生产阶段**：一律用 `generate` → review SQL → `migrate`
  - push 没有 SQL 文件留档，出事不知改了啥
  - push 可能为对齐而 DROP 列，直接丢数据
  - 迁移文件能进 git，团队可审可回滚
