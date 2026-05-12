# Day 3 · 学习笔记索引

> 本目录是一次 AI 问答学习的整理，围绕 **Next.js App Router + Server Action + React 19 hooks + Drizzle 进阶 + PG migration 工程** 展开。
> 按主题拆分成小文件，方便按需回看。

## 目录

### 基础 · Server Action & Server Component

1. [01-Server Action 基础](./01-server-action-basics.md) — Server Action 的本质、Progressive Enhancement、Network 观察结果、throw vs return、form vs onClick 差异
2. [02-Server Action vs API Route](./02-server-action-vs-api-route.md) — HTTP 层本质差别、必须选 API Route 的场景
3. [03-Server Component Hook 限制](./03-server-component-hooks-limits.md) — 哪些 hook 能用、哪些不能
4. [04-为什么 Server Component 被设计](./04-why-server-component-exists.md) — Pages Router SSR 已经能做的事，为什么还需要它
5. [05-Next.js 缓存机制（基础）](./05-nextjs-caching-mechanism.md) — fetch 缓存、tag、path 失效

### Drizzle 与 PG 工程

6. [06-drizzle-kit pull 的产物位置陷阱](./06-drizzle-kit-pull-output.md) — schema 配置 vs out 配置语义不对称
7. [07-PG Driver 对比](./07-postgres-vs-neon-drivers.md) — postgres.js / neon-http / neon-serverless 三个 driver 取舍
8. [08-Edge Runtime 真实取舍](./08-edge-runtime-tradeoffs.md) — 地理悖论 + 反驳"生产都该 edge"误区
9. [09-NOT NULL 迁移 Expand-Contract 模式](./09-not-null-migration-pattern.md) — 生产标准做法：可空 → backfill → 加约束 → 清理

### React 19 + Next.js 进阶

10. [10-revalidatePath × router.refresh 精确语义](./10-revalidate-refresh-precise.md) — **对 05 的校正与深化**：两层缓存 + 两个动作 + 路径写错症状 + Vercel CDN 联动 + 自部署处理
11. [11-useTransition 深度](./11-use-transition.md) — 不只是 isPending：低优更新 + 抢占 + useOptimistic 前置
12. [12-useOptimistic 深度](./12-use-optimistic.md) — 派生 state 公式 + 覆盖型/追加型 reducer + 并发行为 + 高阶推理
13. [13-RSC Payload 成本与渲染优化](./13-rsc-payload-and-rendering.md) — partial rendering + 大列表 5 个优化策略

### 安全 · Layer 4 红线

14. [14-Server/Client 数据边界安全](./14-server-client-boundary-safety.md) — 敏感字段裁剪 + password 哈希存储

### 自检

15. [15-Day 3 自检](./15-day3-self-check.md) — 24 题盲测，含 Layer 4 红线题

---

## 核心心法速查

### Server Action & 缓存
1. **`revalidatePath` 不"刷新"任何东西，只贴"过期"标签**；`router.refresh()` 才是"主动重拉"。两者解决不同问题。
2. **`startTransition` + Server Action** = 框架自动 refresh；`onClick + 普通 fetch` 必须手动 `router.refresh`。
3. **数据来源是 server props（RSC）时**：不要 `useState(props)` 然后手动同步——反模式。让 server action + revalidate 自动 reconcile。
4. **Progressive Enhancement**：Next.js 把 Server Action 编译成 HTTP 端点 + action ID，有 JS 时走 `text/x-component` 自定义协议，无 JS 时降级为标准 form POST。
5. **`<form action>` 自动 router refresh，`<button onClick>` 不会**——这是 form action 的内置行为，不依赖 revalidatePath。
6. **throw vs return**：业务校验 → `return { ok: false }`；系统故障 → `throw` 触发 error boundary。
7. **Server Action = Next.js 生态内通道**，API Route = 对外标准接口。第三方 webhook、移动端、流式响应必须用 API Route。
8. **`revalidatePath` 在 Vercel 上同时失效 Edge CDN**——因为基础设施是集成的。自部署时前置 CDN 不自动联动。
9. **路径写错 = 和没写 revalidatePath 一样**：action 成功但 UI 不刷新。直连数据库刷新页面能看到新数据，fetch + 缓存则命中旧数据。

### React 19 Hooks
4. **`useOptimistic` 核心公式**：`optimisticState = baseState + queue of setOptimistic`。
5. **reducer 形状决定 optimistic 是否跟随 baseState**：覆盖型 `(s,v)=>v` 脱钩，追加型 `(s,v)=>[...s,v]` 同步。
6. **transition 结束 → queue 清空 → optimistic = baseState**：成功路径下 baseState 已经更新；失败路径下 baseState 没变。**同一个机制处理两种 outcome**。
7. **`setOptimistic` 必须在 transition 内**——transition 提供生命周期边界。
8. **baseState 来自 props/server 时 useOptimistic 无可替代**——setState 必须 `useEffect` 同步是反模式。

### Driver & Runtime
9. **driver 选型 = 协议匹配运行环境**：Edge → HTTP；长连 Server → TCP。
10. **`neon-http` 不支持事务**——跨多次 SQL 的"要么全成"业务必须 `neon-serverless`。
11. **Edge runtime 4 大代价**：包兼容、CPU/内存上限、**地理悖论**、调试困难。**不是默认值**。
12. **LLM streaming Edge 比 Node 优**：连接长度 + 冷启动 + **按 CPU 计费**（500× 成本差）。

### Drizzle & Migration
13. **`drizzle-kit pull` 把 schema.ts 放 `out/`，不是 `schema` 配置指向的位置**——pull 不覆盖手写代码。
14. **NOT NULL 迁移 = Expand-Contract 4 步**：可空 → backfill → NOT VALID check → validate → SET NOT NULL → 清理。
15. **Migration 前必问 4 题**：SQL 锁多久？什么写会失败？能 atomic 完成？回滚兼容？

### 数据边界 · Layer 4 红线
16. **Client Component 的 props = 浏览器可见明文**——必须主动裁剪敏感字段。
17. **TypeScript 是边界守门人**：用专用类型卡死可传字段。
18. **密码 / token / secret 一律 hash 或加密存储**——bcrypt / Argon2id，不用 MD5/SHA-256。

---

## 这次学习的元能力总结

今天 day-03 整个学习过程示范了一套"高质量 AI 协作"的姿态：

| 姿态 | 体现 |
|---|---|
| **对 AI 输出保持质疑** | 实测发现"revalidatePath 不调 router.refresh 也能更新"，反过来质疑 AI 给的说法 |
| **用 mental model 推导新场景** | 没遇见过的"协作 todo + 乐观更新失败"场景，能从原理推出 4 个时间点行为 |
| **精确语言** | 用"乐观队列 reducer 放在 baseState 之后执行"这种**机械化、可验证**的描述，而不是模糊的"它会处理失败" |
| **挑战默认叙事** | "Edge 是窄场景为什么要设计？" —— 不接受"现代/默认"等模糊推荐 |

> 这 4 项元能力，比"懂了哪个 API"重要 100 倍。在 M2 ReAct loop、M3 Stripe webhook、M5 RAG 系统的取舍中，都会反复用上。
