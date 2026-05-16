# Neon 驱动选型：HTTP vs WebSocket

> 实战中遇到 `No transactions support in neon-http driver` 错误后的完整知识整理。

## 问题还原

```ts
// db/index.ts — 原始配置
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema, logger: true });
```

调用 `db.transaction()` 时抛出：
```
Error: No transactions support in neon-http driver
```

## 根因

事务要求在**同一个数据库连接**上依次发送 `BEGIN → SQL → COMMIT/ROLLBACK`。

HTTP 驱动每条 SQL 是独立的 HTTP 请求，无法维持 session 状态：
```
Request 1: POST /sql { "query": "BEGIN" }     → 连接 A
Request 2: POST /sql { "query": "INSERT..." }  → 连接 B（A 上的事务上下文丢失）
Request 3: POST /sql { "query": "COMMIT" }     → 连接 C（没有活跃事务可提交）
```

## 两种驱动对比

| 维度 | `neon-http`（HTTP fetch） | `neon-serverless`（WebSocket） |
|---|---|---|
| 底层协议 | 无状态 HTTP REST API | WebSocket / TCP |
| 事务支持 | 不支持 `db.transaction()` | 支持 |
| 连接管理 | 无需管理，每次请求独立 | 需在请求内创建和销毁 |
| 首次延迟 | 低（单次 HTTP 往返） | 略高（WebSocket 握手 + RTT） |
| 后续查询延迟 | 每条 SQL 都是一次 HTTP 往返 | 同连接复用，延迟更低 |
| Node.js ≤21 | 直接可用 | 需手动提供 WebSocket 构造函数 |
| 适用场景 | 简单 CRUD、无事务需求 | 需要事务、复杂查询、生产环境 |

## WebSocket 模式的三条使用约束

### 1. Serverless 环境下连接不能跨请求

Pool/Client 必须在单个请求 handler 内创建、使用、关闭：

```ts
// ✗ 错误：模块顶层创建，跨请求复用
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function handler() {
  return pool.query('SELECT ...');
}

// ✓ 正确：请求内创建，请求内销毁
export async function handler() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await pool.query('SELECT ...');
  } finally {
    await pool.end();
  }
}
```

原因：Vercel Edge Functions / Cloudflare Workers 等环境下，WebSocket 连接无法超越单个请求的生命周期。复用会导致连接泄漏和连接池耗尽。

### 2. Node.js ≤21 需要 WebSocket polyfill

```ts
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = ws;
```

Node 22+、Deno、Bun 有原生 WebSocket，无需此步。

### 3. 冷启动代价

Serverless 冷启动时，WebSocket 需要完整的握手过程（比 HTTP fetch 多一次 RTT）。但在 Next.js Server Actions 场景下影响有限，因为事务带来的数据一致性收益远大于这点延迟。

## Drizzle ORM 适配方案

### 方案 A：`postgres-js`（推荐，项目已有依赖）

```ts
// db/index.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema, logger: true });
```

前置条件：`npm install postgres`（项目已有 `postgres@^3.4.9`）。

### 方案 B：`@neondatabase/serverless` + Pool

```ts
// db/index.ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema, logger: true });
```

### HTTP 模式的有限事务支持

`neon()` 函数提供 `transaction()` 方法，但只支持**非交互式事务**（一次性发送多条 SQL，不能根据中间结果决定分支）：

```ts
const sql = neon(process.env.DATABASE_URL!);
const [posts, tags] = await sql.transaction([
  sql`SELECT * FROM posts ORDER BY posted_at DESC LIMIT 10`,
  sql`SELECT * FROM tags`,
]);
```

不适用于 Drizzle 的 `db.transaction(async (tx) => { ... })` 模式，因为后者需要在回调中根据前一步结果决定下一步操作。

## 决策指南

```
需要事务（db.transaction）？
  ├─ 是 → 用 WebSocket 模式（方案 A 或 B）
  │       适用：批量插入、多表关联操作、需要原子性的写入
  └─ 否 → HTTP 模式也可以
          适用：纯读取、单表简单写入、无状态 Serverless 函数

运行环境是 Edge Runtime？
  ├─ 是 → 连接必须在请求内创建和销毁
  └─ 否 → 可以在模块顶层创建连接池（Node.js 长驻进程）
```

## 关键认知

1. **驱动选型决定能力上限** — `neon-http` vs `neon-serverless` 不是性能差异，而是功能缺失（事务）
2. **事务 = 同一连接上的 SQL 组** — 这和 HTTP 无状态本质矛盾，不是 bug 是设计权衡
3. **Serverless 的经典取舍** — 无状态 HTTP（部署简单、冷启动快）vs 有状态连接（功能完整、事务支持）
4. **非交互式事务是 HTTP 模式的折中** — 一次性发送所有 SQL，但不能在中间做条件判断

## 参考资料

- [Neon Serverless Driver README](https://github.com/neondatabase/serverless/blob/master/README.md)
- [Neon Serverless Driver Architecture](https://zread.ai/neondatabase/serverless/6-serverless-driver-architecture)
- [Drizzle ORM Neon HTTP Adapter](https://orm.drizzle.team/docs/get-started-postgresql-new#neon)
