# 08 · 三张表的增删改查 —— "改哪张表"

## 核心心法

**"谁的属性，改谁的表"**。三张表各管一件事：

| 你想做的事 | 改哪张表 |
|---|---|
| 改 post 的标题、内容 | `posts` |
| 改 tag 的名字 | `tags` |
| 改 post 和 tag 的**关联关系**（贴/取消标签） | `posts_tags` |

## 场景速查

### 场景 1：新建 post 并贴 3 个已有标签（两步）

```typescript
const [post] = await db.insert(posts)
  .values({ title: 'Day 2 笔记' }).returning();

await db.insert(postsTags).values([
  { postId: post.id, tagId: 3 },
  { postId: post.id, tagId: 5 },
  { postId: post.id, tagId: 7 },
]);
```

### 场景 2：给已有 post 加一个 tag（只动 posts_tags）

```typescript
await db.insert(postsTags).values({ postId: 1, tagId: 9 });
```

### 场景 3：取消一个 tag（只动 posts_tags）

```typescript
await db.delete(postsTags).where(and(
  eq(postsTags.postId, 1),
  eq(postsTags.tagId, 5),
));
```

### 场景 4：改 post 标题（只动 posts）

```typescript
await db.update(posts).set({ title: '你好' }).where(eq(posts.id, 1));
```

### 场景 5：改 tag 名字（只动 tags）

```typescript
await db.update(tags).set({ name: '人工智能' }).where(eq(tags.id, 3));
```

所有关联该 tag 的 post 自动"看到"新名字（查询时 JOIN 过去拿 `tags.name`）—— 这就是正规化的好处，**改一处，到处生效**。

### 场景 6：删除一篇 post（只动 posts）

```typescript
await db.delete(posts).where(eq(posts.id, 1));
```

注意 `posts_tags` 里还有指向 `post_id=1` 的关联记录：
- 建表时写了 `onDelete: 'cascade'`：数据库**自动**帮你清理
- 没写 cascade：数据库**拒绝删除**（外键约束违反）

建议建关联表时写 cascade，关联表不会残留孤儿记录。

## 新手常踩的坑

### 坑 1：建关联前先有实体

```typescript
// ❌ 错误：post 还没建，就想关联
await db.insert(postsTags).values({ postId: 999, tagId: 1 });
// 报错：FOREIGN KEY 违反（因为 posts 里没有 id=999）
```

### 坑 2：改关联关系用 DELETE + INSERT，不用 UPDATE

```typescript
// ❌ 别这样
await db.update(postsTags).set({ tagId: 5 }).where(...);

// ✓ 这样更清晰
await db.delete(postsTags).where(and(
  eq(postsTags.postId, 1),
  eq(postsTags.tagId, 3),
));
await db.insert(postsTags).values({ postId: 1, tagId: 5 });
```

语义上关联是"有/无"，不是"改内容"。UPDATE 在复合主键上操作也会很别扭。

### 坑 3：想省事把 tags 名字存到 posts_tags

永远不要把 `tags.name` 复制到 `posts_tags`。改 tag 名字只动一张表（tags），全局生效。

## 读（查询）是三张表都用，靠 JOIN 拼

```sql
-- "post=1 有哪些 tag"
SELECT t.*
FROM tags t
JOIN posts_tags pt ON pt.tag_id = t.id
WHERE pt.post_id = 1;

-- "tag=3 被哪些 post 贴过"
SELECT p.*
FROM posts p
JOIN posts_tags pt ON pt.post_id = p.id
WHERE pt.tag_id = 3;
```

## 心智模型

```
posts        →  "post 这个东西是什么样"   （title, content, created_at, ...）
tags         →  "tag 这个东西是什么样"   （name, color, ...）
posts_tags   →  "谁和谁有关系"          （只有两个 id）
```

**不要想着"哪张表是主的"，没有主次，它们是协作关系。**
