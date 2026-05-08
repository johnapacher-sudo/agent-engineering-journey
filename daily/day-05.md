# Day 5 · 2026-05-12（周二）

> Week 1 · Postgres + Drizzle
> 今天 2-2.5h

## 今天学什么

**主题**：serverless 环境的连接管理 —— 为什么传统 `pg` 连接池在 Vercel 里不能用，以及 Neon 怎么绕过这个问题。

这是 M1 里第一次碰到"serverless 改变游戏规则"的场景。后面的 Inngest / AI SDK / streaming 都有类似味道 —— **你以为你理解的传统后端概念，在 serverless 下要重新学一遍**。

## 核心概念

- **Postgres 连接模型**：传统 Postgres 每个连接是一个独立进程（fork），连接数是稀缺资源（默认 100）。应用层用"连接池"（每个实例复用 10-20 个连接）解决。
- **Serverless 的问题**：Vercel function 每次冷启动都是一个新进程，**连接池无法跨 invocation 复用**。100 个并发请求 → 100 个 function 实例 → 100 个连接 → Postgres 挂。
- **两种解法**：
  1. **外部连接池**（PgBouncer / Neon pooler）：在 Postgres 前面架一个轻量 proxy，function 连 proxy，proxy 维护到 Postgres 的长连接池
  2. **HTTP-based driver**（Neon serverless driver）：完全绕过 Postgres wire protocol，SQL 通过 HTTPS 发给 Neon 前端，前端去查。天然适合 serverless 的"短连接 + stateless"
- **Neon 给你两个 connection string**：
  - pooled：`-pooler` 后缀，走 pgBouncer，用于运行时
  - direct：没后缀，直连 Postgres，用于 migration（migration 需要 prepared statement / transaction，pgBouncer 的 transaction mode 不支持）
- **Edge runtime 的限制**：Vercel Edge（Cloudflare Workers 底层）不能用 Node.js 的 `net` 模块 → 不能用传统 `pg` driver → 必须用 HTTP-based 的 Neon serverless driver
- **`neon-http` vs `neon-serverless`**：
  - `neon-http`：纯 HTTP，适合简单查询，单次 query 开销略高
  - `neon-serverless`：WebSocket，开销小，支持 transaction 和 prepared statement
  - 起步用 `neon-http` 就够

## 参考资源

- **[Neon Serverless Driver Overview](https://neon.tech/docs/serverless/serverless-driver)** — 必读，讲清为什么要这东西
- **[Why serverless needs a new Postgres driver](https://neon.tech/blog/quicker-serverless-postgres)** — Neon 创始人的博客
- **[Drizzle + Neon HTTP](https://orm.drizzle.team/docs/get-started-postgresql#neon)** — Drizzle 侧的集成文档

## 动手练习

升级 Day 4 项目的 DB 层：

1. `pnpm add @neondatabase/serverless`
2. `.env.local` 改成两个 URL：
   ```
   DATABASE_URL=postgresql://...-pooler.neon.tech/neondb?sslmode=require
   DATABASE_URL_UNPOOLED=postgresql://....neon.tech/neondb?sslmode=require
   ```
3. 改 `src/db/index.ts`：从 `drizzle-orm/postgres-js` 切到 `drizzle-orm/neon-http`
   ```ts
   import { neon } from '@neondatabase/serverless'
   import { drizzle } from 'drizzle-orm/neon-http'
   const sql = neon(process.env.DATABASE_URL!)
   export const db = drizzle(sql, { schema })
   ```
4. `drizzle.config.ts` 改用 `DATABASE_URL_UNPOOLED`（migration 不能走 pooler）
5. 跑一遍 `pnpm drizzle-kit migrate` 确认还能成功
6. 本地 `pnpm dev` 确认页面还能正常查询
7. **新增一个 edge route** `app/api/edge-test/route.ts`：
   ```ts
   export const runtime = 'edge'
   ```
   里面 `await db.select().from(users).limit(1)`，部署到 Vercel 访问，确认能在 edge 跑
8. 看 Vercel function log：对比 edge 和 node runtime 的 response time

**卡点思考**：
- 如果 runtime 选 edge，但 driver 还用 `postgres-js`（基于 net），会在 build 期就报错吗？还是运行时？
- pooled connection 的"transaction mode"为什么不能跑 migration？
- 用了 `neon-http`，一个 request 里连续 3 次 `db.select()` 会发 3 个 HTTP 请求吗？能不能优化？

## 今天结束能回答

- 为什么一个 Vercel function 里建立一个 pg 长连接池"技术上能建但生产上会爆"？具体怎么爆？
- `DATABASE_URL` 和 `DATABASE_URL_UNPOOLED` 各自什么场景用？反过来用会发生什么？
- `neon-http` driver 和 `@vercel/postgres` 是什么关系？（提示：后者在底层封装前者）

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 6）是本周的**阶段 2 精读日** —— 把 Drizzle 文档完整过一遍，把 Postgres 索引直觉建立起来
