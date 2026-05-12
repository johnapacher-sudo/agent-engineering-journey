# Day 3 · 自检题汇总

> 用于"关掉 AI、合上文档"后的自我盲测。  
> 标 ⭐⭐⭐ 的是 Layer 4 必修题（涉及生产红线）。

## A. drizzle-kit & 迁移

1. **drizzle-kit pull 输出位置**：你跑 `pull` 后 `db/schema.ts` 没有出现新内容，但跑成功了。**为什么**？要怎么"接管"它的产物？
2. **4 个命令的语义**：`pull` / `generate` / `migrate` / `push` 各自的"方向"（DB ↔ 代码）和典型工作流？
3. ⭐⭐⭐ **NOT NULL 迁移**：你的 posts 表已有 100 万行 + 5% 的 user_id 为 NULL。你想加 NOT NULL 约束。**生产怎么做**？写出至少 3 个 SQL 步骤的伪代码。
4. ⭐⭐⭐ **Migration 4 问**：任何 schema 变更上线前必须问哪 4 个问题？

## B. Driver & Runtime

5. **postgres.js vs neon-http**：协议层各是什么？为什么 Edge runtime 跑不了 postgres.js？
6. **neon-http vs neon-serverless**：核心能力差异是什么？什么场景必须用后者？
7. **地理悖论**：你的 DB 在 us-east-1，用户在中国。Edge runtime + 5 次 DB query 的总延迟，跟 Node serverless 比，**慢还是快**？为什么？
8. **Edge runtime 4 类成立场景**：分别是？多数 CRUD 业务为什么 **不**适合 Edge？

## C. Next.js 缓存 & 渲染

9. **`revalidatePath` 真正做什么**：用一句话精确描述。它"刷新"了什么吗？
10. **`revalidatePath` vs `router.refresh`**：分别在 server / client 哪一端调用？分别影响哪层缓存？
11. **`form action` vs `onClick + server action`**：哪个会自动 refresh？为什么？
12. ⭐ **大列表优化**：你的 `/crud` 页面有 1000 条 post，每次 add 一条就重传整个 RSC payload。**5 个工具**分别是什么？

## D. React 19 Hooks

13. **`useTransition` 真正在做什么**：除了 `isPending`，还有什么核心能力？
14. **`useTransition` vs `useDeferredValue`**：什么场景用哪个？
15. ⭐⭐ **`useOptimistic` 核心公式**：optimisticState = ？写出公式。
16. ⭐⭐ **`useOptimistic` vs `useState`**：用一句话回答本质区别。当 baseState 来自 props 时，**为什么 setState 不能替代**？
17. **覆盖型 vs 追加型 reducer**：哪一种 baseState 变化时 optimistic 跟着变？为什么？
18. **高阶推理**：协作 todo 列表，你 add D 的 transition 期间 server 推来 E，最后你的 add 失败。**4 个时间点 UI 状态分别是什么**？
19. **并发 setOptimistic**：覆盖型 reducer 并发会出问题吗？追加型呢？为什么？

## E. 数据边界安全

20. ⭐⭐⭐ **Server → Client props 暴露**：你 Server Component `getUsers()` 拿到 `SelectUser[]`（含 password 字段），直接 `<ClientComp users={users} />`。**用户能在哪里看到 password 明文**？
21. ⭐⭐⭐ **password 明文存储 4 个泄露场景**：分别是？
22. **bcrypt vs SHA-256**：为什么 bcrypt 故意设计成"慢"？慢的好处是什么？

## F. 综合思考

23. ⭐⭐ **技术选型审美**：今天讨论的"Edge runtime 是默认值"误区是怎么形成的？用同样的姿态分析：HTMX、Bun、tRPC 各自解决了什么问题？谁需要它？
24. **学习纪律自检**：今天你**对 AI 给的哪些说法做了 calibration**？比如哪些细节是你实测发现跟 AI 说的不一致的？

---

## 答得出来 = 真的内化了

如果以上 24 题里 18 题以上能用自己的话讲清楚（不要查资料），你 day-03 的核心 mental model 就建立好了。这套思维在：

- **M2 W5-6**（手写 SSE parser + ReAct loop）：会用到"Server / Client 数据边界"、"streaming 适合 Edge"
- **M3**（Stripe webhook + Inngest）：会用到"事务必须 neon-serverless"、"webhook 必须 Node"、"DB migration 生产规范"
- **M5**（RAG）：会用到"敏感数据不传 Client"、"大列表用流式 / 分页"

——都会反复用上。

> ⚠️ Layer 4 红线提醒：第 20、21、22 题（数据边界安全 + 密码存储）是**生产红线**。这 3 题答错可能导致 **P0 安全事故**。养成肌肉记忆比"懂概念"更重要。
