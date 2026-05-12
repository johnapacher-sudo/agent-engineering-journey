# PostgreSQL Driver 对比：postgres.js vs @neondatabase/serverless

## 一句话结论

`postgres.js` 走 **TCP wire protocol**，是传统长连接 driver；`@neondatabase/serverless` 走 **HTTP 或 WebSocket**，专为 serverless / Edge 设计。

它们解决的不是"功能"问题，而是"运行环境"问题。

## 协议层差异

| 维度 | `postgres` (postgres.js) | `@neondatabase/serverless` |
|---|---|---|
| **传输协议** | 原生 PG wire protocol（TCP 二进制） | HTTP（fetch）或 WebSocket |
| **连接模型** | 持久 TCP 连接 + 客户端连接池 | 每次 query 一次 HTTP 请求，无连接管理 |
| **Drizzle 配对** | `drizzle-orm/postgres-js` | `drizzle-orm/neon-http` / `neon-serverless` |
| **Node API 依赖** | 需要 `net`、`tls`（Node 模块） | 只用 `fetch`（Web 标准） |
| **可跑在 Edge / Cloudflare Workers** | ❌ 不行（无 TCP） | ✅ 行 |
| **首次 query 延迟** | TCP+TLS 握手开销 | HTTPS 握手开销 |
| **后续 query 延迟** | ⚡ 极低（连接复用） | 略高（每次新 HTTP，H2 keep-alive 缓解） |
| **高 QPS 单进程** | 完胜 | 较差 |
| **冷启动 / serverless 场景** | 较差（频繁建连接撑爆 max_connections） | 完胜（无状态） |

## Drizzle 的两个 Neon Adapter

`@neondatabase/serverless` 提供两个 client，对应 Drizzle 的两个 adapter：

| 维度 | `drizzle-orm/neon-http` | `drizzle-orm/neon-serverless` |
|---|---|---|
| 用的 client | `neon()` 函数 | `Pool` / `Client` 类 |
| **传输协议** | **HTTP**（fetch） | **WebSocket**（WSS 隧道里跑 PG wire protocol） |
| 连接模型 | 无状态：每次 query 一个 HTTPS 请求 | 有状态：长连接、连接池 |
| **是否支持事务** | ❌ **不支持** | ✅ 支持 |
| Prepared statements | 弱（每次都是新请求） | ✅ 完整支持 |
| LISTEN / NOTIFY | ❌ 不支持 | ✅ 支持 |
| 第一次 query 延迟 | TLS 握手 + HTTP 请求 | WSS 握手 + 一次往返 |
| 后续 query 延迟 | 每次都是新 HTTP（HTTP/2 keep-alive 缓解） | 复用同一 WebSocket → 极低 |
| Edge runtime 兼容 | ✅ 完美 | ⚠️ 需要 Node `ws` polyfill |

### 实操判断

```ts
// neon-http：简单查询 / 简单 mutation
const users = await db.select().from(usersTable);  // ✅
await db.insert(usersTable).values(...);            // ✅

// neon-http：事务 ❌ 会 throw
await db.transaction(async (tx) => {
  await tx.insert(...);
  await tx.update(...);
});

// neon-serverless：所有都支持，包括事务
await db.transaction(async (tx) => {
  const [user] = await tx.insert(usersTable).values(...).returning();
  await tx.insert(profilesTable).values({ userId: user.id, ... });
});  // 任一失败全部回滚
```

## 选型决策表

| 部署场景 | DB 在哪 | 推荐 driver |
|---|---|---|
| 长期运行的 Node.js server（VM / Docker / Render / Railway） | 同 region | `postgres.js` |
| Vercel Node.js serverless functions | 同 region | 都行，Neon 官方推 `neon-http` |
| Vercel Edge Functions / Cloudflare Workers | 任意 region | `@neondatabase/serverless` (`neon-http`) |
| 需要事务的业务（订单+扣库存、注册+创建默认数据） | - | 必须 `neon-serverless` 或 `postgres.js` |
| 接 Supabase / 自建 PG / RDS | - | `postgres.js`（Neon HTTP 是 Neon 专属） |

## 心法

1. **driver 选型 = 协议匹配运行环境**：Edge → HTTP；长连 Server → TCP。
2. **`neon-http` 不支持事务**——简单 CRUD 够用，但跨多次 SQL 的"要么全成"业务必须 `neon-serverless`。
3. **"事务隐含在单条 SQL 里"** ≠ 需要显式事务：`db.insert().values([row1, row2, row3])` 是一条 SQL，本身原子；**需要事务的是"跨多次 db.xxx 调用"的场景**。
4. **不要无脑跟"现代 = HTTP" 的潮流**：传统 server 用 `postgres.js` 性能完胜，单次 query < 1ms 连接开销。

## 自检题

1. 你跑在 Vercel 的 Node serverless function（不是 Edge），DB 在同 region。`postgres.js` 跟 `neon-http` 哪个更快？为什么？答案可能跟你直觉相反。
2. `neon-serverless` 走 WSS 隧道传 PG wire protocol——WebSocket 也是基于 TCP 的。**为什么 Edge runtime 能跑 WebSocket 但跑不了原生 TCP**？
3. 一个业务需要：注册用户 → 创建默认 profile → 发欢迎邮件。**哪些步骤应该在事务里，哪些不应该**？为什么？
