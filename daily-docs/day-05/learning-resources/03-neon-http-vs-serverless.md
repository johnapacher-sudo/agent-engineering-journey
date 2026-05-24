# neon-http vs neon-serverless 对比

## 核心区别

| | `neon-http` | `neon-serverless` |
|---|---|---|
| 传输方式 | 每次查询一个 HTTP 请求 | WebSocket（维持会话） |
| 事务支持 | 受限（非交互式：一次性发所有 SQL） | 完整（交互式：BEGIN → 看结果 → COMMIT） |
| Prepared statement | ❌ | ✅ |
| 单次查询开销 | 略高（每次 HTTP 往返） | 低（复用 WebSocket 连接） |
| 连接管理 | 零（用完即弃） | 要管（WebSocket 要关、要重连） |
| Edge runtime 兼容 | ✅ 完美 | ✅ 能用但部分场景受限 |
| 适用场景 | 简单 CRUD、Serverless 函数 | 需要交互式事务的复杂操作 |

## 判断标准

用 `neon-http` 还是 `neon-serverless`，关键看：**事务里的操作是否依赖前面操作的结果？**

```ts
// ✅ neon-http 可以处理（不依赖中间结果）
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'Tom' });
  await tx.insert(posts).values({ title: 'Post 1' });
  await tx.insert(tags).values({ name: 'tech' });
  // 三条 INSERT 互相不依赖，打包一次性发
});

// ❌ neon-http 处理不了（需要看中间结果再决定）
await db.transaction(async (tx) => {
  const [user] = await tx.select().from(users).where(eq(users.id, 1));

  if (user.balance < 100) {           // ← 依赖前面 SELECT 的结果
    throw new Error('余额不足');       // ← 根据结果决定下一步
  }

  await tx.update(users).set({ balance: sql`balance - 100` }).where(eq(users.id, 1));
});
```

## neon-http 的事务安全性

`neon-http` 下 `db.transaction()` 的事务语义和 `neon-serverless` **完全一样**：

- 中间任何一条 SQL 失败 → PG 自动回滚整个事务
- 只是**发送方式**不同：把 `BEGIN → SQL1 → SQL2 → COMMIT` 打包成一次 HTTP 请求

```ts
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'Tom' });      // ✅
  await tx.insert(posts).values({ title: 'Post 1' });  // ❌ 炸了
  await tx.insert(comments).values({ content: '...' }); // 不会执行
});
// Tom 的 user 也回滚了，什么都没进数据库
```

`tx` 上的 `await` 在 `neon-http` 下**缓存起来**，等 callback 正常走完才一次性发。如果 callback 抛错，直接发 `ROLLBACK`。

## 代码组织

### 方案 1：全用 neon-serverless（最实际）

```ts
// db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

一个实例搞定所有场景，能做的事更多，开销微乎其微。

### 方案 2：双实例

```ts
// db/index.ts
import { neon as neonHttp } from '@neondatabase/serverless';
import { neon as neonWs } from '@neondatabase/serverless';

export const dbHttp = drizzle(neonHttp(process.env.DATABASE_URL!));
export const dbWs = drizzle(neonWs(process.env.DATABASE_URL!));
```

简单查询用 `dbHttp`，事务操作用 `dbWs`。

### 推荐

```
默认用 neon-http，碰不到交互式事务就继续
碰到需要交互式事务时 → 切换到 neon-serverless
```

大多数业务到这一步都不需要换。
