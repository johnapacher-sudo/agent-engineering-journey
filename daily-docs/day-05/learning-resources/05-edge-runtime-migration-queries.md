# Edge Runtime 兼容性、Migration 失败机制、查询优化

## 一、Edge Runtime 兼容性：postgres-js 为什么不能用

### 核心结论

**选 Edge Runtime → 必须选基于 `fetch`/`WebSocket` 的驱动，基于 TCP（`net` 模块）的驱动在 build 阶段就会被拦住。**

### 什么时候报错

```
next dev（本地开发）
  → 默认跑在 Node.js runtime 上
  → 即使写了 runtime = 'edge'，本地 dev 可能用 Node.js 兼容模式
  → postgres-js "看起来正常"

next build（构建）
  → 编译 Edge route 时，webpack/turbopack 用类似 webworker 的 target
  → postgres-js 里 import net → net 不在 Edge 白名单 → 💥 构建报错

部署到 Vercel Edge
  → 如果 build 过不了，根本到不了这步
```

### 驱动兼容表

| 驱动 | 底层依赖 | Edge Runtime | Node.js Runtime |
|---|---|---|---|
| `postgres` (postgres-js) | `net` (TCP) | ❌ build 失败 | ✅ |
| `pg` (node-postgres) | `net` (TCP) | ❌ build 失败 | ✅ |
| `@neondatabase/serverless` HTTP 模式 | `fetch` (Web API) | ✅ | ✅ |
| `@neondatabase/serverless` WebSocket 模式 | `WebSocket` | ✅ | ✅ |

### Edge Runtime 的 Node.js 兼容层

Edge Runtime 底层是 **V8 引擎**（Chrome 的 JS 引擎），不是 Node.js。Next.js 加了一层 polyfill 覆盖小部分常用 API。

**有（白名单）**：

| 类别 | 可用的 API |
|---|---|
| Web 标准 | `fetch`, `Request`, `Response`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `AbortController`, `WebSocket`, `ReadableStream`, `WritableStream`, `crypto.subtle`, `Headers` |
| Node.js polyfill | `Buffer`, `process.env`, `process.nextTick`, 部分 `stream.Readable` |
| Next.js 扩展 | `NextRequest`, `NextResponse`, cookies, headers |

**没有（被排除）**：

| 被排除的 | 为什么 |
|---|---|
| `net` (TCP) | Edge 短生命周期，不适合维护 TCP 长连接 |
| `tls` | TLS 握手开销大 |
| `fs` (文件系统) | CDN 节点没有本地文件系统 |
| `child_process` | 不能在 CDN 节点上起子进程 |
| `http` / `https`（Node.js 模块） | 用 Web 标准 `fetch` 替代 |
| `os`, `dns`, `cluster` | 系统级操作不支持 |

**一句话：Edge Runtime 不是"阉割版 Node.js"，是"V8 引擎 + Web 标准 API + 少量 Node.js polyfill"。**

---

## 二、Pooled 连接（Transaction Mode）为什么不适合跑 Migration

### PgBouncer Transaction Mode 的工作方式

```
客户端 A → BEGIN → 从池里拿连接 #1 → 执行 SQL → COMMIT → 连接 #1 还回池
客户端 A → BEGIN → 可能拿到连接 #3（不一定是 #1）
```

每次事务之间，底层 PG 连接可能换。事务内是同一个连接，事务之间不保证。

### Migration 工具实际做的事

以 drizzle-kit 为例：

```sql
-- 第 1 步：防并发（auto-commit）
SELECT pg_advisory_lock(12345);

-- 第 2 步：查当前状态（auto-commit）
SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 1;

-- 第 3 步：设超时保护（auto-commit）
SET statement_timeout = '600s';
SET lock_timeout = '10s';

-- 第 4 步：执行 DDL（显式事务）
BEGIN;
  ALTER TABLE users ADD COLUMN email TEXT;
  CREATE INDEX idx_users_email ON users (email);
COMMIT;

-- 第 5 步：记录 migration（auto-commit）
INSERT INTO drizzle_migrations (hash, created_at) VALUES ('abc123', now());

-- 第 6 步：释放锁（auto-commit）
SELECT pg_advisory_unlock(12345);
```

这些操作**不都在同一个事务里**，有些在事务外（auto-commit）。

### 具体失败机制

#### 1. Advisory Lock 失效

```
第 1 步: SELECT pg_advisory_lock(12345)
  → 在连接 #1 上加锁，auto-commit 结束，连接 #1 还回池

第 2 步: SELECT * FROM drizzle_migrations
  → 可能分配到连接 #2（不是 #1）
  → 连接 #2 上没有 advisory lock
  → 连接 #1 可能被别人拿走
```

Advisory lock 绑定在**连接**上，不是绑定在"你"上。换了连接，锁就跟你没关系了。

#### 2. SET 参数丢失

```
第 3 步: SET statement_timeout = '600s'
  → 在连接 #3 上设置
  → auto-commit 结束，连接 #3 还回池
  → PgBouncer 清理会话状态（重置参数）

第 4 步: ALTER TABLE ...
  → 分配到连接 #4，statement_timeout = 默认值（不是 600s）
```

#### 3. DDL 锁状态不一致

DDL 涉及**表级锁**，锁的生命周期和连接绑定。跨事务换连接 = 锁状态不可预测。

#### 4. Migration 记录不同步

```
ALTER TABLE 成功了，但 INSERT drizzle_migrations 失败
→ 表结构改了，migration 记录没写
→ 下次再跑：以为没跑过，又 ALTER → 报错 "column already exists"
```

### 为什么"大部分时候没问题"

简单 migration 长这样：

```sql
BEGIN;
  CREATE TABLE simple_table (id SERIAL PRIMARY KEY, name TEXT);
COMMIT;
```

一个事务、没有 advisory lock、没有 SET、DDL 简单 → 整个操作在同一个事务内，PgBouncer 不会换连接 → 能跑通。

**出问题的是复杂场景：多步操作、跨事务依赖、会话状态、并发保护。**

### 失败机制总结

| 失败机制 | 根因 | 什么时候出问题 |
|---|---|---|
| Advisory lock 失效 | 锁绑定在连接上，换连接锁就丢了 | 多人/多环境同时跑 migration |
| SET 参数丢失 | 会话状态在连接回收时被重置 | 大表 DDL 需要调超时 |
| DDL 锁状态不一致 | 表锁和连接绑定，换连接锁行为不可预测 | 并发 DDL 操作 |
| Migration 记录不同步 | 多步操作可能在不同连接上执行 | 任何多步 migration |

**用 direct 连接 = 整个 migration 过程用一个稳定的 PG 连接，所有风险消失。**

---

## 三、neon-http 多次查询优化

### 问题：3 次 `db.select()` = 3 个 HTTP 请求

```ts
// 串行发 3 个 HTTP 请求，总耗时 = 3 次网络往返
const users = await db.select().from(usersTable)
const posts = await db.select().from(postsTable)
const tags = await db.select().from(tagsTable)
```

每次 `await` 都是独立的 `fetch()`。

### 三种优化方式

#### 方式 1：`Promise.all` — 3 个请求并行

```ts
// 3 个请求同时发出，总耗时 ≈ 1 次网络往返
const [users, posts, tags] = await Promise.all([
  db.select().from(usersTable),
  db.select().from(postsTable),
  db.select().from(tagsTable),
])
```

请求数没变，但时间从 3T 降到 ~T。

#### 方式 2：`db.transaction()` — 1 个请求

```ts
// 1 个 HTTP 请求：BEGIN → SELECT users → SELECT posts → SELECT tags → COMMIT
const [users, posts, tags] = await db.transaction(async (tx) => {
  const u = await tx.select().from(usersTable)
  const p = await tx.select().from(postsTable)
  const t = await tx.select().from(tagsTable)
  return [u, p, t]
})
```

neon-http 下 `tx` 上的 `await` **不会触发 HTTP 请求**，而是把 SQL 缓存起来，等 callback 结束后一次性打包发送。只有 **1 个 HTTP 请求**。

#### 方式 3：JOIN — 1 条 SQL = 1 个请求

```ts
// 1 条 SQL，1 个 HTTP 请求
const result = await db
  .select()
  .from(usersTable)
  .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
```

数据库层面合并数据，适合查询之间有关联关系的场景。

### 怎么选

| 方式 | HTTP 请求数 | 适用场景 |
|---|---|---|
| `Promise.all` | 3（并行） | 查询互相独立，不想包事务 |
| `db.transaction()` | 1 | 查询互相独立，想省网络开销 |
| JOIN | 1 | 查询之间有关联关系 |

**大多数场景用 `db.transaction()` 包一下就够了**——不改变 SQL 逻辑，只是把多次网络往返压成一次。
