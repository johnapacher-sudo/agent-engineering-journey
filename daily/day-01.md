# Day 1 · 2026-05-08（周五）

> Week 1 · Postgres + Drizzle
> 今天 2-2.5h

## 今天学什么

**主题**：为什么 agent 应用需要一个真正的数据库，以及 Drizzle 这个 TypeScript-first ORM 为什么能成为 2024-2026 的主流选择。

资深前端接触 DB 往往停留在"ORM = 跑命令就行"。但你后面要做的 agent 应用会有 conversation history、vector store、user memory 这些强 schema 的东西。Day 1 的目标不是"把命令跑通"，而是在脑子里建立「schema as code → migration → runtime query」这条心智链路。

## 核心概念

- **Schema as code**：DB schema 用 TypeScript 声明（`schema.ts`），不是直接写 SQL。优点是类型安全一路传到查询；缺点是你得学 Drizzle 的 DSL。
- **Migration 的两种流派**：
  - `generate` + `migrate`（diff-based）：改 schema.ts → 生成 SQL 文件 → 执行。适合生产。
  - `push`（declarative）：直接把 schema.ts 同步到 DB，跳过 SQL。适合原型。
- **Drizzle vs Prisma**：Drizzle 是 query builder（更贴近 SQL），Prisma 是"不懂 SQL 也能用"的抽象。你是工程师，应该学 Drizzle。
- **Neon serverless**：传统 `pg` 连接池在 Vercel serverless 里会爆（每个冷启动都建新连接）。Neon 提供一个 HTTP-based 的 driver 绕过这个问题。今天先用默认 driver，Day 5 再深入。
- **Server Component 里直接 query DB**：Next.js App Router 的默认姿势是 page 本身就是 server function，直接 `await db.select()` 就能拿数据，不需要 API route。

## 参考资源

- **[Drizzle Overview](https://orm.drizzle.team/docs/overview)** — 10 分钟，先建立整体印象
- **[Neon Quickstart with Next.js](https://neon.tech/docs/guides/nextjs)** — 官方教程，对照它的步骤做
- **[Drizzle + Next.js Tutorial](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)** — 今天的动手模板

## 动手练习

从零搭一个 Next.js + Drizzle + Neon 项目，跑到 Vercel 上能访问。**不要跟着教程抄，跟着教程做一遍，然后关掉教程自己再做一遍**，第二遍出错时认真读 error message。

路径：

1. `pnpm create next-app@latest agent-journey-m1 --ts --tailwind --app --src-dir`
2. 注册 Neon → 建 project → 复制 connection string 到 `.env.local`（命名 `DATABASE_URL`）
3. 装 Drizzle：`pnpm add drizzle-orm postgres` + `pnpm add -D drizzle-kit tsx dotenv @types/node`
4. 写 `src/db/schema.ts`：一张 `users` 表（id / email / name / createdAt）
5. 写 `drizzle.config.ts`
6. 跑 `pnpm drizzle-kit generate` 看生成的 SQL 文件长什么样 → `pnpm drizzle-kit migrate` 执行
7. 写 `src/db/index.ts` 导出 db client
8. `app/page.tsx` 直接 `const users = await db.select().from(usersTable)` 渲染（空数组也行）
9. push GitHub → Vercel import → 配 `DATABASE_URL` → 部署

**遇到错时的思考路径**：
- "relation users does not exist" → migration 没跑 / 跑在了不同 DB
- "Cannot find module 'postgres'" → 没装依赖 / 引错了路径
- 连不上 DB → connection string 里 `?sslmode=require` 漏了 / Neon 的 branch 选错了

## 今天结束能回答

- Drizzle 的 `schema.ts` 和数据库里的物理表，中间经过了哪几步才同步？
- `generate` 和 `push` 两种 migration 方式，各自适合什么场景？为什么生产环境不该用 `push`？
- 在 `app/page.tsx` 里直接 `await db.select()` 会跑在哪里？客户端能看到这个 query 吗？

## 晚上 10 min

- `journal.md` 写 3 行：
  - 今天 **aha** 的一个点
  - 今天留了一个 **疑问**（明天问或自己挖）
  - 今天注意到一个 **想深挖的分支**（但先不挖，记着）
- commit & push（哪怕只是 README 改了一行）
- 勾选 `notes/m1-progress.md` 的 Day 1（可选）
