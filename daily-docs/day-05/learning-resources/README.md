# Day 5 · 学习笔记索引

> 本目录是 Day 5 AI 问答学习的整理，围绕 **Serverless 环境的连接管理** 展开。

## 目录

1. [01-Serverless 连接管理问题](./01-serverless-connection-problem.md) — 传统连接池在 serverless 下失控的原因、PgBouncer vs Neon HTTP 本质区别、两个连接串（pooled/direct）、PgBouncer 能力限制、代码组织
2. [02-Serverless 颠覆传统后端概念](./02-serverless-changes-everything.md) — 进程假设被抽掉后的六大崩塌点、Inngest/AI SDK/Streaming 的应对
3. [03-neon-http vs neon-serverless 对比](./03-neon-http-vs-serverless.md) — 交互式 vs 非交互式事务、代码组织方案、判断标准
4. [04-App Router API 路由](./04-app-router-api-routes.md) — route.ts 约定规则、URL 路径映射、动态路由、HTTP 方法、Edge Runtime、与 Pages Router 对比
5. [04-Neon Serverless Driver 底层优化](./04-neon-serverless-driver-internals.md) — 连接 9 步拆解、TLS 1.2 vs 1.3、加密下沉、SCRAM 认证取舍、消息 Pipelining
6. [05-Edge Runtime 兼容性、Migration、查询优化](./05-edge-runtime-migration-queries.md) — Edge 白名单、PgBouncer transaction mode 失败机制、neon-http 多次查询优化
7. [06-Day 5 自检题校验记录](./06-day5-self-check.md) — 连接池爆炸机制、pooled/unpooled 反用后果、@vercel/postgres 与 neon-http 关系

---

## 核心心法速查

### 连接管理
1. **问题不是"没有连接池"，是实例太多**：100 个 function 实例各建自己的池，总连接数失控
2. **PgBouncer = 优化连接复用**：仍在"长连接"体系内，你的代码要管连接池生命周期
3. **Neon HTTP = 换到无连接体系**：你的代码只管发 fetch()，连接管理推到你看不见的层
4. **HTTPS 底层也是 TCP**：区别不在协议本身，在"连接管理的责任在谁手里"
5. **Neon HTTP 的代价**：不支持完整事务（不能根据中间结果决定 COMMIT/ROLLBACK）
6. **Pooled 连接串 = Neon 托管的 PgBouncer**：不需要自己部署，连到 `-pooler` 地址就行
7. **Migration 必须用 Direct**：PgBouncer 不支持 prepared statement、advisory lock、SET 持久化，migration 工具依赖这些能力
8. **两个环境变量两个入口**：`DATABASE_URL`（pooled）给 runtime，`DIRECT_URL`（direct）给 drizzle-kit，代码不用改

### Serverless 思维转换
9. **传统后端假设进程活着，Serverless 把这个假设抽掉了**
10. **连接池** → 用 HTTP driver 或外部 pooler
11. **后台任务** → Inngest 等框架帮你调度单步函数
12. **长耗时响应** → Streaming 边产边推，避免超时
13. **长连接** → SSE + 客户端重连，多次短连接拼成流

### neon-http vs neon-serverless
14. **判断标准**：事务里有没有 `if (查询结果)` → 有就必须 neon-serverless，没有就 neon-http 够
15. **neon-http 的事务一样安全**：中间 SQL 失败照样 ROLLBACK，只是发送方式是一次性打包
16. **默认用 neon-http，碰到交互式事务再换**：90% 业务不需要换
17. **代码组织推荐**：全用 neon-serverless（一个实例搞定所有场景，开销微乎其微）

### App Router API 路由
18. **文件名必须是 `route.ts`**：App Router 按约定文件名识别功能
19. **URL 路径 = 文件系统路径去掉 `app/` 和 `route.ts`**：`api/` 不是自动加的前缀，只是惯例目录名
20. **`route.ts` 和 `page.tsx` 不能共存**：一个路径要么是页面，要么是 API，不能同时是两者
21. **动态路由段**：`[id]` 必填参数，`[...slug]` 捕获全部，`[[...slug]]` 可选捕获
22. **导出 HTTP 方法函数**：`GET`, `POST`, `PUT`, `DELETE`... 框架自动路由到对应方法
23. **Request/Response 是标准 Web API**：跟浏览器 `fetch` 一样，不是 Express 风格
24. **App Router vs Pages Router**：新 API 用 `route.ts`，旧的不改，可以混用

### Neon Serverless Driver 底层优化
18. **连 9 步只有最后 1 步在干活**：前面 8 步全是 TCP/WebSocket/TLS/认证握手，真正的查询在第 9 步
19. **TLS 1.3 比 1.2 少一轮**：客户端直接"猜"服务端支持的算法（砍掉老旧算法后几乎 100% 猜对），省一轮协商
20. **加密下沉到 WebSocket**：wss: 已经加密了，Postgres 内层 TLS 多余，省掉 SSLRequest 问询这一轮
21. **SCRAM 故意慢（~100ms CPU）防暴力破解**：在 Serverless（10ms CPU 预算）里跑不完；Neon 用随机密码替代"算得慢"的防护策略
22. **Pipelining 把三条消息打包一次发**：startup + 密码 + 查询不用等回复，直接一股脑发出去，省 2 轮
23. **最终 9 → 4 轮**：TLS 1.3(-1) + 加密下沉(-1) + 去 SCRAM(-1) + Pipelining(-2)

### Edge Runtime 兼容性
24. **Edge Runtime 是 V8 + Web API + 少量 Node.js polyfill**：不是阉割版 Node.js，是完全不同的运行时
25. **`net`/`tls`/`fs` 在 Edge 不可用**：基于这些模块的驱动（postgres-js、pg）在 `next build` 阶段就报错
26. **选 Edge → 必须用 `fetch`/`WebSocket` 驱动**：`@neondatabase/serverless` 两种模式都支持

### Migration 失败机制
27. **PgBouncer transaction mode 每次事务之间可能换连接**：auto-commit 语句之间不保证同一个底层 PG 连接
28. **Advisory lock 绑定连接不绑定用户**：换了连接，锁就丢了，防并发的 migration 互相冲突
29. **SET 参数在连接还回池时被重置**：`statement_timeout` 等保护性参数失效
30. **简单 migration 大部分能跑通**：出问题的是多步、跨事务、有会话状态的复杂场景

### 查询优化
31. **neon-http 下 3 次 `db.select()` = 3 个 HTTP 请求**：每次 await 都是独立 fetch
32. **`db.transaction()` 把多次查询压成 1 个请求**：neon-http 下 tx.await 只缓存 SQL，callback 结束后一次性打包
33. **`Promise.all` 并行发 3 个请求**：请求数不变，但时间从 3T 降到 ~T
34. **大多数场景 `db.transaction()` 包一下就够**：不改 SQL 逻辑，省网络开销
