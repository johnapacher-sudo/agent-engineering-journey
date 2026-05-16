# 12 · Transaction 三铁律：必 await、串行、不嵌套

> 上下文：写 `createUserWithPostsAndTags` 时，用了"事务套事务的循环 + Promise.all"——技术上语法合法，但实际有 5 个 bug，会导致**数据不一致 + 运行时错误**。这一篇定下 transaction 的 3 条不可破铁律。

---

## 三铁律（牢记）

### 铁律 1：transaction 必须被外层接住

```ts
// ❌ 函数立即返回 undefined，事务在后台 fire-and-forget
export const create = async (data) => {
  db.transaction(async (tx) => { ... });
};

// ✅ 任意一种：return / await / await + return
export const create = async (data) => {
  return db.transaction(async (tx) => { ... });        // 推荐
};
export const create = async (data) => {
  return await db.transaction(async (tx) => { ... });   // 多一次 unwrap，但 stack trace 更清晰
};
export const create = async (data) => {
  await db.transaction(async (tx) => { ... });
  return /* 别的东西 */;
};
```

**why**：transaction 是 Promise，必须传给调用者去 `await`，否则：
- 调用者根本不知道事务跑没跑完
- 事务里 throw 了，调用者也接不住（unhandled rejection）
- 生产里这是**最可怕的 bug 类型**：不报错、不返回失败、但数据错了

### 铁律 2：transaction 内永远 `for...of + await`，永远不 `Promise.all`

```ts
// ❌ tx 内并发：postgres-js 排队、node-postgres 抛错、Neon 不可预测
await Promise.all([
  tx.insert(postsTable).values(p1),
  tx.insert(postsTable).values(p2),
]);

// ✅ 串行
for (const p of posts) {
  await tx.insert(postsTable).values(p);
}
```

**why**：transaction 在 PostgreSQL 上**绑定单一连接**——单连接同一时刻只能处理一条 statement：

| Driver | tx 内 Promise.all 行为 |
|---|---|
| `postgres-js`（你用的） | 默默排队执行，无收益但不报错 |
| `node-postgres` (pg) | 抛 `Error: another command is already in progress` |
| `@neondatabase/serverless` | 行为不确定，可能 hang，可能错乱 |

而且**事务的本质就是串行**——「按顺序执行 A、B、C，要么全成要么全败」。`Promise.all` 等于在表达「我不在乎顺序」，跟事务语义自相矛盾。

### 铁律 3：99% 场景不要嵌套 transaction

```ts
// ❌ 嵌套：增加复杂度，几乎没有真实收益
return db.transaction(async (outerTx) => {
  await createUser(data, outerTx);
  await outerTx.transaction(async (innerTx) => {  // ← 内层 SAVEPOINT
    await createPost(post, innerTx);
  });
});

// ✅ 平铺到一层
return db.transaction(async (tx) => {
  await createUser(data, tx);
  await createPost(post, tx);
});
```

**why**：嵌套事务在 PostgreSQL 上是 **SAVEPOINT** 实现的：

```sql
BEGIN;                          -- 外层
  INSERT users ...;
  SAVEPOINT inner_1;            -- 内层 = SAVEPOINT
    INSERT posts ...;
  RELEASE SAVEPOINT inner_1;    -- 内层 commit
COMMIT;                         -- 外层 commit
```

嵌套事务的**唯一价值**：内层失败时只回滚内层、外层继续。如果你内层失败要外层全回滚（99% 场景），**根本不需要嵌套**——一层 transaction 就够。

---

## 反例剖析：5 个 bug 同时存在的代码

```ts
export const createPostWithTags = async (data, tx2?: any) => {
  const { tags, ...post } = data;
  const createTagList: Promise<...>[] = [];
  
  (tx2 || db).transaction(async (tx) => {              // ⚠️ Bug 1: 没 return/await
    for (const tag of tags) {
      createTagList.push(createTag(tag, tx));          // 立刻执行，无控制
    }
    const [postResult, tagResults] = await Promise.all([  // ⚠️ Bug 2: tx 内 Promise.all
      createPost(post, tx),
      Promise.all(createTagList),
    ]);
    
    await Promise.all(tagResults.map((tag) => {
      createPostsTags({ postId: postResult.id, tagId: tag.id }, tx);
                                                       // ⚠️ Bug 3: map 没 return
    }));
  });
};
```

### Bug 1：transaction 没 return / await

函数立即返回 `undefined`，事务在后台异步跑。调用者 `await createPostWithTags()` 等于 `await undefined`，瞬间继续执行。

### Bug 2：tx 内 `Promise.all`

postgres-js 默默排队（无收益），其他 driver 抛错。

### Bug 3：`map` 回调没 return

```ts
tagResults.map((tag) => {
  createPostsTags({ ... }, tx);  // 没 return!
})
// → 返回 [undefined, undefined, undefined]
// → Promise.all([undefined, undefined, undefined])
// → 立刻 resolve
// → 根本不等 createPostsTags 完成
```

事务 callback 立刻返回 → 事务 commit → 然后 createPostsTags 才在后台跑——**这时事务已经结束了**，行为完全未定义。

### Bug 4：tag 永远新建，不 upsert

```ts
for (const tag of tags) {
  createTagList.push(createTag(tag, tx));  // 直接 INSERT
}
```

如果 `tags.name` 有 unique constraint，第二次插同名 tag → 唯一冲突 → 事务回滚。
应该用 `INSERT ... ON CONFLICT (name) DO UPDATE ... RETURNING`（PG upsert），Drizzle 写法 `.onConflictDoUpdate()` 或 `.onConflictDoNothing()`。

### Bug 5：`tx?: any` 类型滥用

放弃 TS 类型保护。正确类型应该是 `PgTransaction<...>` 或推导：

```ts
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
```

---

## 正确写法

```ts
import { sql } from 'drizzle-orm';

interface InsertPostWithTags extends Omit<InsertPost, 'userId'> {
  tags: InsertTag[];
}
interface InsertUserWithPostsAndTags extends InsertUser {
  posts?: InsertPostWithTags[];
}

export const createUserWithPostsAndTags = async (
  data: InsertUserWithPostsAndTags,
) => {
  return db.transaction(async (tx) => {                     // ← return
    // 1. user
    const [user] = await tx.insert(usersTable).values({
      userName: data.userName,
      email: data.email,
      password: data.password,
    }).returning();

    // 2. posts + tags（如果有）
    if (data.posts?.length) {
      for (const postData of data.posts) {                  // ← for...of 串行
        const { tags, ...postFields } = postData;

        const [post] = await tx.insert(postsTable).values({  // ← await 每一步
          ...postFields,
          userId: user.id,
        }).returning();

        if (tags?.length) {
          for (const tagInput of tags) {                    // ← for...of 串行
            const [tag] = await tx
              .insert(tagsTable)
              .values(tagInput)
              .onConflictDoUpdate({                         // ← upsert
                target: tagsTable.name,
                set: { name: sql`excluded.name` },
              })
              .returning();

            await tx
              .insert(postsTagsTable)
              .values({ postId: post.id, tagId: tag.id })
              .onConflictDoNothing();                       // ← 重复关联无害
          }
        }
      }
    }

    return user;
  });
};
```

修复对应：

| 修复 | 原 bug |
|---|---|
| 顶层 `return db.transaction(...)` | Bug 1：调用方能拿到结果 |
| 全程 `for...of + await` | Bug 2：不在 tx 内 Promise.all |
| 每个 `await tx.insert(...)` | Bug 3：每一步真等到 |
| `.onConflictDoUpdate({ target: tagsTable.name, set: { ... } })` | Bug 4：tag 已存在直接拿 id |
| `.onConflictDoNothing()` | 关联表重复无害 |
| 用 `tx` 没用 `any` | Bug 5：类型推导自动 |

---

## "嵌套 transaction" 唯一合法的场景

如果**业务上**真的需要"内层失败不影响外层"，才需要嵌套。例如：

```ts
return db.transaction(async (tx) => {
  // 主流程：必须成功
  await createInvoice(tx, ...);
  
  // 副流程：失败也不影响主流程
  try {
    await tx.transaction(async (innerTx) => {
      await sendNotification(innerTx, ...);  // 内层失败回滚到 SAVEPOINT
    });
  } catch (e) {
    // 副流程错误，记日志但不影响发票
    console.error('notification failed', e);
  }
  
  // 继续主流程
  await markInvoiceComplete(tx, ...);
});
```

但绝大多数 CRUD 场景**根本不需要这种隔离**——一个失败就全失败，平铺到单层 transaction 即可。

---

## Drizzle Transaction API 速查

```ts
// 启动
await db.transaction(async (tx) => {
  await tx.insert(...).values(...);          // tx 替代 db
  await tx.update(...).set(...).where(...);
  await tx.delete(...).where(...);
  await tx.query.X.findMany({...});          // 关系查询也支持
});

// 隔离级别（默认 READ COMMITTED 已经够了，详见笔记 05）
await db.transaction(
  async (tx) => { ... },
  { isolationLevel: 'serializable' }         // 仅在真有并发写冲突时才用
);

// 回滚（throw 即可）
await db.transaction(async (tx) => {
  await tx.insert(...);
  throw new Error('rollback');               // 自动回滚整个事务
});

// 嵌套（SAVEPOINT，慎用）
await db.transaction(async (outerTx) => {
  await outerTx.insert(...);
  await outerTx.transaction(async (innerTx) => {
    await innerTx.insert(...);               // 失败只回滚内层
  });
});
```

---

## 一句话内化

> **Transaction 三铁律**：
> 1. **必 return / await**：没 return = 没事务（函数立即返回，事务在 limbo）
> 2. **永远串行**：tx 内单连接，`Promise.all` 不是优化是 bug
> 3. **不嵌套**：99% 场景一层 tx + for...of 比嵌套 + 并发更对、更快、更易读
>
> "事务套事务的循环"在 PostgreSQL 上**技术合法**，但**几乎永远是设计错误的信号**——把它压平成单层串行就解决了。

---

## Muscle Memory 关联

| 本笔记知识点 | 对应 Layer 4 muscle memory |
|---|---|
| 事务原子性保证 | 第 7 项「正确的 Server Action（含 auth + 错误 envelope）」的核心 |
| upsert + 关联表 | M3 写 agent 持久化层会反复用 |
| 一层 tx + for...of | 第 8 项「Inngest function（含 retry + onFailure）」的同款思维 |
| 嵌套事务的取舍 | 第 9 项「Stripe subscription 状态机」会涉及 |

---

## 相关笔记

- [04 · Transaction 跨表原子操作](./04-transaction-acid.md)
- [05 · 隔离级别与 MVCC](./05-isolation-mvcc.md)
- [13 · 树形数据 → 批量扁平化](./13-tree-to-flat-batch-insert.md)
