# Day 5 自检题校验记录

## 1. 为什么 Vercel function 里建立 pg 长连接池"技术上能建但生产上会爆"？

**我的回答**：serverless function 创建的连接池只用一次连接就销毁了，连接无法被复用，生产多个请求就会创建多个连接，超过默认 100 就崩溃了。

**校验**：方向对，但"只用一次就销毁"不够精确。

连接池**在同一个 function 实例（warm start）内会被复用**。问题是 serverless 有**很多实例**，每个实例有自己的池，池之间不共享：

```
请求 1 → 启动实例 A → 创建连接池（10 个连接）→ 处理完
请求 2 → 实例 A 还在（warm）→ 复用同一个连接池 ✅

请求 3（并发）→ 启动实例 B → 创建新连接池（10 个连接）
请求 4（并发）→ 启动实例 C → 创建新连接池（10 个连接）
...
请求 100 → 启动实例 Z → 创建新连接池（10 个连接）

总连接数 = 100 实例 × 10 连接 = 1000 个
PG 默认 max_connections = 100 → 💥
```

**爆的方式**：
1. **连接数耗尽**：新请求来了，PG 拒绝连接 → 函数报错 → 用户看到 500
2. **连接泄漏**：函数实例被销毁时，连接池可能没正确关闭 → 僵尸连接占着名额
3. **雪崩**：高峰期并发高 → 大量实例启动 → 大量连接创建 → PG 拒绝服务

---

## 2. DATABASE_URL（pooled）和 DATABASE_URL_UNPOOLED（direct）各自什么场景用？反过来用会发生什么？

**我的回答**：pooled 适合 serverless HTTP 非事务场景，unpooled 适合 migration 或传统 TCP 连接。反过来 serverless 只支持 HTTP 请求，TCP 无法访问。

**校验**：部分正确，需要修正。

| | `DATABASE_URL`（pooled，-pooler） | `DATABASE_URL_UNPOOLED`（direct） |
|---|---|---|
| 用途 | runtime 查询（走 PgBouncer） | migration（直连 PG） |
| 事务 | 支持，但有限制 | 完整支持 |
| 场景 | serverless 环境下防止连接数爆炸 | 需要 prepared statement / advisory lock / SET 持久化 |

**反过来用**：

| 反着用 | 结果 |
|---|---|
| **Serverless 里用 UNPOOLED** | 简单查询能跑，但高并发时直接连 PG，连接数线性增长 → 打到 max_connections → 所有请求失败。不是"连不上"，是"压力大了才炸"。 |
| **Migration 用 POOLED** | 简单 migration 能跑通。复杂 migration（prepared statement、advisory lock）会 silently 失败，报错信息不会告诉你是 PgBouncer 的锅。 |
| **Edge Runtime + TCP driver（pg/postgres-js）+ UNPOOLED** | ❌ **确实连不上**。Edge Runtime 没有 `net` 模块，`pg` driver 依赖 `net.createConnection()` → 直接报错。 |
| **Edge Runtime + @neondatabase/serverless + UNPOOLED** | ✅ **能连上**。HTTP/WebSocket driver 不走 TCP，走 `fetch` / WebSocket API，不受 Edge Runtime 限制。 |

---

## 3. neon-http driver 和 @vercel/postgres 是什么关系？

**我的回答**：不了解。

**校验**：`@vercel/postgres` 底层就是 `@neondatabase/serverless`（neon-http driver），加了一层更友好的 API。

```
你的代码
  │
  ├── 直接用 @neondatabase/serverless
  │     const sql = neon(process.env.DATABASE_URL);
  │
  └── 用 @vercel/postgres（封装层）
        import { sql } from '@vercel/postgres';
        // 自动读 POSTGRES_URL 环境变量，不用手动传 connectionString
```

**@vercel/postgres 多做了什么**：
- 自动读 `POSTGRES_URL` 环境变量（不用手动传）
- 自动连接复用和清理
- 自动识别 Vercel 环境并优化
- 内置类型定义

**什么时候用哪个**：
- 用 Neon 但不在 Vercel 部署 → `@neondatabase/serverless`
- 在 Vercel 部署 + 想少写配置 → `@vercel/postgres`
- 需要精细控制连接行为 → `@neondatabase/serverless`

---

## 错误反思

| 题目 | 我的答案 | 实际 | 教训 |
|---|---|---|---|
| 连接池销毁 | "只用一次就销毁" | warm start 内会复用，跨实例不共享 | 理解 serverless 的"实例"概念 |
| Edge + UNPOOLED | "TCP 无法访问" | 准确说是"TCP driver 无法使用"，HTTP driver 不受限制 | 区分"连接字符串"和"driver"两个层面 |
| @vercel/postgres | 不了解 | 是 neon-http 的封装层 | 技术栈要了解上下游关系 |
