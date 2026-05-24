# Serverless 环境的连接管理问题

## 问题：为什么传统 PG 连接池在 Vercel 里不能用

### 传统服务器

```
1 个 Node 进程 → 1 个连接池（10 个连接）→ 永远最多 10 个连接到 PG
```

连接池在进程内存里，进程活着池就在，连接可以复用。

### Vercel Serverless

```
100 个并发请求 → 启动 100 个 function 实例
每个实例各自建连接池 → 最坏情况 100 × 10 = 1000 个连接到 PG
PG 默认 max_connections ≈ 100 → 💥 打爆
```

问题不是"没有连接池"，而是**实例太多，每个实例都有自己的池，总连接数失控**。连接池存在于进程内存里，serverless 进程随时生灭，池无法跨 invocation 复用。

## 两种解法

### 解法 1：外部连接池（PgBouncer / Neon pooler）

在 Postgres 前面架一个轻量 proxy，function 连 proxy，proxy 维护到 Postgres 的长连接池。

```
Function ──TCP（PG wire protocol）──→ PgBouncer ──TCP──→ Postgres
```

你的代码仍然要管理数据库连接（连接池配置、生命周期），只是连接到 PgBouncer 而不是直连 PG。

### 解法 2：HTTP-based driver（Neon serverless driver）

完全绕过 PG wire protocol，SQL 通过 HTTPS 发给 Neon 前端，前端去查。

```
Function ──HTTPS（普通 HTTP 请求）──→ Neon 服务 ──内部──→ Postgres
```

你的代码只是发 HTTP 请求，不管理连接。Neon 在服务端维护连接池。

## 两种解法的本质区别

用户的核心疑问：两种解法不都是"前面加一层代管连接"吗？

**是的，都有一层代理。区别在于你的代码要不要管连接。**

| | PgBouncer | Neon HTTP |
|---|---|---|
| 你的代码要管连接吗 | 要（连接池配置、生命周期） | 不要（就是发 HTTP 请求） |
| 冷启动建的是什么 | PG 客户端连接（TCP + PG 认证 + 参数协商） | HTTP 请求（Node.js 运行时自动管底层 TCP） |
| 连接泄漏风险 | 有（你的代码负责关闭） | 没有（请求结束就完了） |
| 事务支持 | 完整（BEGIN → 多步操作 → COMMIT） | 受限（不能根据中间结果分支） |
| 部署 | 你自己管（或 Neon 托管） | Neon 内置 |

### HTTPS 也是基于 TCP，为什么说开销更低？

HTTPS 确实基于 TCP，两者的底层传输一样。区别不在"有没有 TCP 连接"，而在：

- **PgBouncer**：你的代码用 PG wire protocol，要管连接池对象、配置、超时、关闭。PG 协议本身还有认证握手、参数协商等额外开销。
- **Neon HTTP**：你的代码只是 `fetch()`，Node.js 运行时自动管理底层 TCP（HTTP keep-alive）。你不需要配连接池、不需要管生命周期。

```ts
// PgBouncer 方式：你要管连接
const sql = postgres(connectionString, {
  max: 10,           // 配连接池大小
  idle_timeout: 20,  // 管超时
});

// Neon HTTP 方式：你只管发请求
const sql = neon(connectionString);
const result = await sql`SELECT * FROM users`;
// 底层就是一个 fetch，没有连接池对象要管理
```

**PgBouncer 是在"长连接"体系里优化连接复用，Neon HTTP 是换到"无连接"体系彻底避开问题。**

## Neon 的两个连接串

Neon 给你两个 connection string：

```
Pooled:  postgres://...@ep-xxx-pooler.neon.tech/db   ← 走 Neon 托管的 PgBouncer
Direct:  postgres://...@ep-xxx.neon.tech/db           ← 直连你的 Postgres 实例
```

Pooled 就是 Neon 帮你托管了 PgBouncer——不需要自己部署，连到 `-pooler` 地址就行。

## PgBouncer 的能力限制

PgBouncer 为了做连接复用，牺牲了一些 PG 能力：

| 能力 | 说明 | PgBouncer 为什么不支持 |
|---|---|---|
| **Prepared statement** | 预编译 SQL，后续只发参数，重复查询更快 | 请求可能路由到另一个 PG 连接，那个连接上没有缓存 |
| **DDL** | CREATE TABLE / ALTER TABLE 等修改表结构 | 会锁表，PgBouncer 中途换连接导致锁状态不一致 |
| **Advisory locks** | 应用级锁，防止多个进程同时做同一件事 | 换了连接就丢了锁 |
| **SET 命令** | 设置会话参数（如 statement_timeout） | 事务结束后重置会话状态，参数丢失 |
| **LISTEN/NOTIFY** | PG 内置消息通知（进程 A 通知进程 B） | 需要维持长连接，PgBouncer 不支持 |

### 各能力的实际用途

**Prepared statement**：
```
普通查询：每次发完整 SQL → PG 解析 → 生成执行计划 → 执行
Prepared：第一次发 SQL → PG 编译缓存 → 后续只发参数 → 直接执行
```

**Advisory locks**：
```sql
SELECT pg_advisory_lock(12345);   -- 加锁："只有我能做这件事"
-- 做需要互斥的操作（如 migration）
SELECT pg_advisory_unlock(12345); -- 解锁
```

**LISTEN/NOTIFY**：
```sql
-- 进程 A
LISTEN order_created;            -- 监听

-- 进程 B
NOTIFY order_created, 'order_42'; -- 发通知

-- 进程 A 收到通知 → 触发处理
```

## 为什么 Migration 必须用 Direct

Migration 工具（drizzle-kit）要做的事：
```sql
BEGIN;
  SELECT pg_advisory_lock(12345);     -- 防并发 migration（pooled 下锁不住）
  SET statement_timeout = '600s';     -- 超时保护（pooled 下事务结束就丢）
  CREATE TABLE new_table (...);       -- DDL（pooled 下可能不可靠）
COMMIT;
```

用 pooled 跑 migration 的风险：
- 简单 migration 大部分情况能用（你之前没出问题就是这个原因）
- 复杂场景会炸，而且报错信息不会告诉你是 PgBouncer 的锅
- 建议：**直接用 direct，消除隐患**

## 代码怎么组织：两个环境变量，两个入口

```bash
# .env（本地）/ Vercel Environment Variables（线上）

# Runtime 用（查询、Server Action 等）
DATABASE_URL=postgres://...@ep-xxx-pooler.neon.tech/db

# Migration 用（drizzle-kit）
DIRECT_URL=postgres://...@ep-xxx.neon.tech/db
```

```ts
// db/index.ts — Runtime 连接（业务代码永远用这个）
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);  // ← pooled
export const db = drizzle(sql);
```

```ts
// drizzle.config.ts — Migration 连接（drizzle-kit 自动读这个）
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!,  // ← direct
  },
});
```

**不需要经常改代码**。业务代码永远 `import { db } from '@/db'`，drizzle-kit 命令自动读 config 用 direct。两边互不干扰。

## 我的理解过程

初始理解：Neon HTTP 在服务层做了连接池，绕开 serverless 的连接问题。
校正：理解方向正确，但两种解法的核心区别不是"有没有代理层"，而是**连接管理的责任在谁手里**——你的代码还是运行时。
二次校正：Neon 的 pooled 连接串就是托管版 PgBouncer，migration 用 direct 不是"一定会出问题"而是"出了问题很难排查根源"。
