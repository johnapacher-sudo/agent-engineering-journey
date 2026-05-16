# 13 · 树形数据 → 批量扁平化：消除 5 层 for-of 嵌套

> 上下文：写 `createUserWithPostsAndTags` 时担心"5-6 层数据查询难免会有 for-of 嵌套"。这一篇讲怎么把"深度优先 + 嵌套循环"翻译成"广度优先 + 批量插入"——5 层缩进变 1 层，N×M×K 条 SQL 变 4 条。

---

## 问题：嵌套来自数据形状

业务数据天然是树形：

```
user
  ├ post 1
  │   ├ tag a
  │   └ tag b
  └ post 2
      ├ tag c
      └ tag d
```

**直觉写法（深度优先）**：

```ts
for (const user of users) {
  await tx.insert(usersTable).values(user);
  for (const post of user.posts) {
    await tx.insert(postsTable).values({...post, userId: user.id});
    for (const tag of post.tags) {
      await tx.insert(tagsTable).values(tag).onConflictDoUpdate(...);
      await tx.insert(postsTagsTable).values({...});
    }
  }
}
```

**代价**：
- **缩进 5 层**，加错误处理、helper 直接到 7-8 层
- **SQL 数量 = N × M × K × 2**（user × post × tag × 2 个 insert）—— 100 user × 5 post × 3 tag = 3000 条 SQL
- 每条 SQL 一次网络往返 —— 单次 import 耗时几十秒

---

## 解法：批量扁平化（broadly-first + bulk insert）

把**深度优先**翻译成**广度优先**：

```
深度优先（嵌套）：       广度优先（扁平）：
                        
user → post → tag       Step 1: 一次插所有 user
user → post → tag       Step 2: 一次插所有 post（带上 user.id）
user → post → tag       Step 3: 一次插所有 tag（去重 + upsert）
user → post → tag       Step 4: 一次插所有 (post, tag) 关联
```

**收益**：
- SQL 数量从 N×M×K 变成 **4 条**
- 缩进从 5 层变 **1 层**
- 一次往返插 100 行 ≈ 一次往返插 1 行（PG 最贵的是网络 + 解析，不是行数）

---

## 完整代码示例

```ts
import { sql } from 'drizzle-orm';
import { db } from '../index';
import {
  postsTable,
  postsTagsTable,
  tagsTable,
  usersTable,
} from '../schema';

interface BulkInput {
  users: Array<{
    userName: string;
    email: string;
    password: string;
    posts: Array<{
      title: string;
      content: string;
      tags: Array<{ name: string }>;
    }>;
  }>;
}

export const bulkCreateUsersWithPostsAndTags = async (data: BulkInput) => {
  return db.transaction(async (tx) => {
    // ===== Step 1: 一次插所有 user =====
    const insertedUsers = await tx
      .insert(usersTable)
      .values(
        data.users.map((u) => ({
          userName: u.userName,
          email: u.email,
          password: u.password,
        })),
      )
      .returning();
    // insertedUsers 顺序跟 data.users 一致 → 用 index 对齐

    // ===== Step 2: 在 JS 里展平所有 post（带 userId） =====
    const allPostsWithMeta = data.users.flatMap((u, i) =>
      u.posts.map((p) => ({
        title: p.title,
        content: p.content,
        userId: insertedUsers[i].id,
        _tags: p.tags, // 临时挂着，下面用
      })),
    );

    // 一次插所有 post
    const insertedPosts = await tx
      .insert(postsTable)
      .values(
        allPostsWithMeta.map(({ _tags, ...p }) => p),
      )
      .returning();

    // ===== Step 3: 收集所有不重复的 tag name，一次 upsert =====
    const uniqueTagNames = [
      ...new Set(allPostsWithMeta.flatMap((p) => p._tags.map((t) => t.name))),
    ];

    let tagIdByName = new Map<string, number>();
    if (uniqueTagNames.length > 0) {
      const insertedTags = await tx
        .insert(tagsTable)
        .values(uniqueTagNames.map((name) => ({ name })))
        .onConflictDoUpdate({
          target: tagsTable.name,
          set: { name: sql`excluded.name` }, // 触发 RETURNING 拿到 id
        })
        .returning();
      tagIdByName = new Map(insertedTags.map((t) => [t.name, t.id]));
    }

    // ===== Step 4: 在 JS 里建 (postId, tagId) 关联，一次批量插 =====
    const allLinks = allPostsWithMeta.flatMap((p, i) =>
      p._tags.map((t) => ({
        postId: insertedPosts[i].id,
        tagId: tagIdByName.get(t.name)!,
      })),
    );

    if (allLinks.length > 0) {
      await tx
        .insert(postsTagsTable)
        .values(allLinks)
        .onConflictDoNothing();
    }

    return { users: insertedUsers, posts: insertedPosts };
  });
};
```

**对比之前**：

| 维度 | 5 层 for-of | 批量扁平 |
|---|---|---|
| 缩进 | 5 层 | 1 层 |
| SQL 数量（100 user × 5 post × 3 tag） | ~3000 条 | 4 条 |
| 往返耗时（每条 ~5ms） | ~15 秒 | ~20ms |
| 代码可读性 | 难（嵌套深） | 易（流水线） |
| Tag 去重 | 每次都新建（导致冲突） | 自动去重 + upsert |

---

## 关键技术点

### 1. `flatMap` 把树展平

```ts
data.users.flatMap((u, i) =>
  u.posts.map((p) => ({ ...p, userId: insertedUsers[i].id }))
)
// 把 [[p1, p2], [p3]] 展平成 [p1, p2, p3]，同时给每个 post 带上 user 的真实 id
```

### 2. `Set` 去重 + `Map` 反查

```ts
const uniqueTagNames = [...new Set(allTagNames)];     // 去重
const tagIdByName = new Map(insertedTags.map(t => [t.name, t.id]));  // name → id 反查表
```

### 3. `.returning()` 拿到全部 ID

PG 的 `INSERT ... RETURNING *` 可以一次拿到所有插入行的完整数据（包括自增 id），Drizzle 的 `.returning()` 包装了这个。

**返回顺序跟传入的 values 数组顺序一致**——这是依赖的核心，所以可以用 index 对齐：`insertedUsers[i]` 对应 `data.users[i]`。

### 4. `onConflictDoUpdate` 让 upsert 也能 RETURNING

```ts
.onConflictDoUpdate({
  target: tagsTable.name,
  set: { name: sql`excluded.name` },  // 故意写无变化的更新，触发 RETURNING
})
.returning();
```

如果用 `.onConflictDoNothing()`，**冲突的行不会出现在 RETURNING 里**——你拿不到旧 tag 的 id。所以要用 `DoUpdate` 配一个无害的 set，强制走 update 路径。

详细原理见下一节「ON CONFLICT 三件套深入」。

---

## 附：ON CONFLICT 三件套深入（PostgreSQL UPSERT 机制）

`onConflictDoUpdate` 是 PostgreSQL `INSERT ... ON CONFLICT (...) DO UPDATE SET ...` 的 Drizzle 包装——也叫 **UPSERT**（INSERT + UPDATE）。这是 PG 的杀手锏特性，搞懂它能处理 90% 的"插入还是更新"场景。

### 三个组成部分

```ts
.onConflictDoUpdate({
  target: tagsTable.name,                        // ① 监听哪个 unique 冲突
  set: { name: sql`excluded.name` },             // ② 冲突时怎么 UPDATE
})
.returning();                                     // ③ 拿回所有行（新插的 + 冲突的）
```

对应的 SQL：

```sql
INSERT INTO tags (name) VALUES ('react'), ('vue')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
RETURNING *;
```

### `target`：监听哪个冲突

PostgreSQL 一张表可以有多个 unique 约束。`target` 告诉 DB：**"我只处理这个 unique 的冲突，别的冲突直接抛错"**。

```ts
// 单列 unique
target: tagsTable.name

// 复合 unique（如 unique on (name, userId)）
target: [tagsTable.name, tagsTable.userId]

// 主键
target: tagsTable.id
```

**铁律**：`target` 必须**严格对应表上某个 unique constraint 或 primary key**。否则 PG 报错：

```
there is no unique or exclusion constraint matching the ON CONFLICT specification
```

普通 index（非 unique）不能当 target。

### `EXCLUDED`：PG 临时伪表

```ts
set: { name: sql`excluded.name` },
```

`excluded` 是 PostgreSQL 在 `ON CONFLICT` 子句里**临时创造的伪表**——只在 ON CONFLICT 内可用。

它代表 "**这一行如果没冲突，本来要插入的那条数据**"。

举例：

```sql
-- 库里已有 ('react', 'red', 100)
INSERT INTO tags (name, color, count)
VALUES ('react', 'blue', 1)
ON CONFLICT (name) DO UPDATE 
SET 
  color = EXCLUDED.color,                  -- 'blue'（本来要插的颜色）
  count = tags.count + EXCLUDED.count;     -- 100 + 1 = 101（合并）
-- 结果：('react', 'blue', 101)
```

| 伪表 | 含义 | 在 ON CONFLICT 里 |
|---|---|---|
| `EXCLUDED.x` | "**本来要插入的**值"（来自 VALUES） | ✓ |
| 表名.x 或省略表名 | "**冲突行当前**的值"（库里已经存在的） | ✓ |

### DoNothing vs DoUpdate 的关键区别：RETURNING 行为

| 子句 | RETURNING 返回什么 |
|---|---|
| `DO NOTHING` | **只返回新插入的行**——已存在的冲突行不返回 |
| `DO UPDATE SET ...` | **返回所有行**——新插入的 + 被更新的冲突行 |

```sql
-- 库里有 ('react', 1)，要插 ('react', _) 和 ('vue', _)

-- DoNothing 版本
INSERT INTO tags (name) VALUES ('react'), ('vue')
ON CONFLICT (name) DO NOTHING RETURNING *;
-- 结果：[(vue, 2)]   ← react 被跳过，不返回！

-- DoUpdate 版本（即使啥也不真改）
INSERT INTO tags (name) VALUES ('react'), ('vue')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *;
-- 结果：[(react, 1), (vue, 2)]   ← 两个都返回！
```

### 为什么需要"假更新" `name = EXCLUDED.name`

我们的批量插入场景**必须拿到所有 tag 的 id**——包括已存在的——后面要建关联表。

- 用 `DoNothing` → 已存在的 react 不返回 → Map 缺 react 的 id → 关联表插不进去
- 用 `DoUpdate SET name = excluded.name` → 全部返回 → Map 完整

`name = EXCLUDED.name` 是 **"无害更新"**——表面重写了 name 字段，实际值没变。**唯一目的就是让冲突行进入 RETURNING**。

更"诚实"的替代写法：

```ts
.onConflictDoUpdate({
  target: tagsTable.name,
  set: { updatedAt: new Date() },          // 顺带刷新时间戳
})
// 或者（PG 14+）
.onConflictDoUpdate({
  target: tagsTable.name,
  set: { name: tagsTable.name },           // name = name（自我等值）
})
```

但生产里最常见就是 `excluded.x = excluded.x`，因为：
- 简洁
- 不引入副作用（不改 updated_at）
- 一眼看出"我只是想 RETURNING"

### 4 个最常用的 ON CONFLICT 配方

#### 配方 1：插入或递增计数

```ts
.onConflictDoUpdate({
  target: pageViewsTable.url,
  set: { count: sql`${pageViewsTable.count} + 1` },
})
```

单次往返实现"首次访问建行，否则计数 +1"。

#### 配方 2：插入或更新时间戳

```ts
.onConflictDoUpdate({
  target: sessionsTable.userId,
  set: { lastSeenAt: new Date() },
})
```

"session 不存在就建，存在就更新 last_seen"——比 SELECT → UPDATE 少一次往返且原子。

#### 配方 3：插入或合并 JSONB

```ts
.onConflictDoUpdate({
  target: userPrefsTable.userId,
  set: {
    preferences: sql`${userPrefsTable.preferences} || ${JSON.stringify(newPrefs)}::jsonb`,
  },
})
```

PG 的 `||` 操作符合并 JSONB，新 key 覆盖旧的。

#### 配方 4：批量 upsert 拿 id（本笔记的核心场景）

```ts
.onConflictDoUpdate({
  target: tagsTable.name,
  set: { name: sql`excluded.name` },        // 无害更新强制 RETURNING
})
.returning();
```

### 4 个隐藏的坑

#### 坑 1：values 内部不能有重复的 conflict key

```sql
INSERT INTO tags (name) VALUES ('react'), ('react')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name;
-- ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time
```

**代码里必须先去重再插**——用 `Map<name, tag>` 或 `Set<string>` 去重。

#### 坑 2：target 必须是 unique 约束，不能是普通 index

```sql
CREATE INDEX idx_name ON tags(name);   -- 普通 index

INSERT ... ON CONFLICT (name) DO UPDATE ...
-- ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

只有 `UNIQUE` 或 `UNIQUE INDEX` 或 `PRIMARY KEY` 才能当 target。

#### 坑 3：`onConflictDoUpdate` 支持 `where`，但 `excluded` 只在 ON CONFLICT 子句内可用

```ts
.onConflictDoUpdate({
  target: tagsTable.name,
  set: { count: sql`excluded.count` },
  where: sql`${tagsTable.count} < excluded.count`,  // ✓ 只在 count 增加时更新
})
```

但外层 INSERT/SELECT 里**不能用** `excluded`——它只活在 ON CONFLICT 子句里。

#### 坑 4：复合 unique 的 target 必须严格对应

```ts
// 表上：unique on (name, userId)
.onConflictDoUpdate({
  target: tagsTable.name,                     // ❌ 不匹配，缺 userId
})
.onConflictDoUpdate({
  target: [tagsTable.name, tagsTable.userId], // ✓ 字段集严格相同
})
```

少字段或多字段都报错。

### MySQL 的对比

PG 的 ON CONFLICT 跟 MySQL 的 ON DUPLICATE KEY UPDATE 概念相似但有差异：

| | PostgreSQL | MySQL |
|---|---|---|
| 语法 | `ON CONFLICT (target) DO UPDATE SET ...` | `ON DUPLICATE KEY UPDATE ...` |
| 监听哪个 unique | 必须指定 `target` | 自动监听所有 unique 冲突 |
| 引用新值 | `EXCLUDED.x` | `VALUES(x)` 或 `NEW.x` |
| 跳过冲突 | `DO NOTHING` | `INSERT IGNORE` |
| RETURNING | 原生支持 | 需要 `LAST_INSERT_ID()` workaround |

**结论**：PG 的设计更精确（必须显式 target），更易在多 unique 表上用。Drizzle 用 PG dialect 时直接享受这套机制。

---

## 还有一招：UUID 解除"等 ID"依赖

Auto-increment id 必须等 INSERT 返回才能拿——这是嵌套的根源。如果用 **UUID 主键**，可以**在 JS 里提前生成所有 ID**：

```ts
const userId = crypto.randomUUID();           // 不用 INSERT 也能知道 id
const postId = crypto.randomUUID();           // 不用等 user 插完
const tagId = crypto.randomUUID();

// 然后插入完全无序——所有 ID 都已经在手里
await tx.insert(usersTable).values({ id: userId, ... });
await tx.insert(postsTable).values({ id: postId, userId, ... });
await tx.insert(postsTagsTable).values({ postId, tagId });
```

**代价**：
- UUID 占 16 bytes（integer 4-8 bytes）
- 索引体积大几倍
- 读取性能略低

**收益**：
- 完全消除"链式 await"问题——所有数据可以并行准备
- 跨服务生成 ID 不冲突（client、worker、batch 都能造 id）
- 安全：不暴露行数信息（auto-increment 暴露 user id 间隔可推测注册量）

很多 SaaS 用 UUID 就是这个原因（Stripe、Linear、Notion、Supabase 全是 UUID）。

---

## 性能数字（你笔记里值得记的）

| 操作 | 大致耗时（local PG） |
|---|---|
| 一次 INSERT 1 行 | ~1-5ms（取决于网络） |
| 一次 INSERT 100 行 | ~5-10ms |
| 一次 INSERT 1000 行 | ~20-50ms |
| 一次 INSERT 10000 行 | ~200-500ms |

**结论**：批量插入 1000 行 ≈ 单条插入 5 行的耗时。**网络往返 + SQL 解析才是瓶颈**，行数本身基本免费。

但批量也有上限：
- 一条 INSERT 超过几千行可能撞 PostgreSQL 的 `max_locks_per_transaction`
- 一条超过 1MB 可能撞网络包大小
- 实际 hot path 用 chunk：`for (const chunk of chunkArray(allRows, 500)) { await tx.insert(...).values(chunk) }`

---

## 这套思维不只用于 DB

「**树形数据 → 批量扁平化**」是写 Agent 系统时**反复出现**的 pattern：

| 场景 | 树形原数据 | 扁平化后 |
|---|---|---|
| Agent 对话历史 | conversation → turns → tool_calls | events table，按 timestamp 排 |
| 文件夹层级 | folder → folder → file | flat table + parent_id |
| DOM tree | element → children → children | flat list + sibling pointers |
| LLM streaming events | `message → content_block → delta` | events array |
| ReAct trace | trace → steps → (thought + action + observation) | spans table |

**记住模式**：
1. 树形适合"读"（懒加载、按需展开）
2. 扁平适合"写"（批量、并发、跨服务复制）
3. 大多数后端存储应该是扁平的，应用层临时构造树形

---

## 一个 mental model

```
"嵌套的根因 = 数据形状是树"
    ↓
"想消除嵌套 = 把树展平成几个独立列表"
    ↓
"展平后每个列表批量插入 = 1 条 SQL 替代 N 条"
    ↓
"批量插入返回 ID = 用 Map 在 JS 里建立关联"
```

---

## 一句话内化

> **5 层嵌套是数据形状的诱因，不是必然结果。**
> 把"深度优先 for-of"翻译成"广度优先 + 批量"，5 层缩进就变 1 层。
> **一次往返插 100 行 ≈ 一次往返插 1 行**——这是 SQL 性能的"魔法"，不是别人写得复杂，是你写得不够"批"。

---

## Muscle Memory 关联

| 本笔记知识点 | 对应 Layer 4 muscle memory |
|---|---|
| flatMap + Map(id→entity) 模式 | 第 2 项「Tool use 完整报文流」的对话历史展平 |
| 批量插入的网络模型 | 第 1 项「Anthropic Messages API 的 fetch 调用」的 SSE 批处理 |
| UUID 解依赖 | 第 9 项「Stripe subscription 状态机」的事件 ID 设计 |
| 树→扁平思维 | 第 4 项「ReAct loop」的 trace 持久化 |

---

## 相关笔记

- [04 · Transaction 跨表原子操作](./04-transaction-acid.md)
- [12 · Transaction 三铁律](./12-transaction-three-rules.md)
