# Day 8 · 2026-05-15（周五）

> Week 2 · Auth + Payment
> 今天 2-2.5h

## 今天学什么

**主题**：Auth 系统的职责分工 —— 身份源（identity provider）和你自己的 DB 之间如何同步。

作为前端你大概率用过 Auth0 / NextAuth / Clerk，但多半是"配完就 work"。今天要理解的是：**Clerk 持有"真·身份"，你的 DB 持有"业务数据"，两者通过 webhook + clerkId 桥接**。这套模式后面 M5 Langfuse 对接、M6 MCP server auth 都会重现。

## 核心概念

- **Identity Provider 的抽象**：Clerk 负责"这个人是谁"（登录、密码、OAuth、session）；你的 DB 负责"这个人在你产品里有什么"（订阅、posts、偏好）。**永远不要把密码存自己 DB**。
- **`clerkId` 桥接模式**：你 DB 的 `users.clerkId` 是 Clerk 那边 user id 的副本。所有业务关联用你自己的 `users.id`，不用 `clerkId` 当外键。
- **Webhook 是 IdP → 业务 DB 的同步通道**：用户在 Clerk 侧 sign up / 删账号时，Clerk 发 webhook 到你的 `/api/webhooks/clerk` 让你同步。用户**不能**在你应用里产生 User 记录 —— 一定是"Clerk 先有，你 DB 后有"。
- **Webhook signature verification**：Clerk 用 Svix 签名，你必须验签才能信任 payload。否则任何人都能往你 endpoint 发假 webhook 篡你 DB。
- **Middleware 保护路由**：Next.js middleware 在 edge 层拦所有请求。Clerk 的 `clerkMiddleware` 读 cookie → 解析 session → 决定放行/跳 sign-in。`matcher` 决定哪些路径走 middleware（一般不匹配 `_next/static` 和图片）。

## 参考资源

- **[Clerk Next.js Quickstart](https://clerk.com/docs/quickstarts/nextjs)** — 15 min，先整体跑通
- **[Clerk Webhooks](https://clerk.com/docs/webhooks/sync-data)** — 20 min，重点看 Svix signature 验证部分
- **[Clerk Middleware](https://clerk.com/docs/references/nextjs/clerk-middleware)** — 10 min，理解 matcher 语法

## 动手练习

在 Week 1 项目上接 Clerk：

1. 注册 Clerk → 建 application → 复制 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` 到 `.env.local`
2. `pnpm add @clerk/nextjs svix`
3. 建 `middleware.ts`（根目录，不是 `src/`）：
   ```ts
   import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
   const isProtected = createRouteMatcher(['/posts(.*)'])
   export default clerkMiddleware((auth, req) => {
     if (isProtected(req)) auth.protect()
   })
   export const config = { matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'] }
   ```
4. `app/layout.tsx` 包 `<ClerkProvider>`
5. 建 `app/sign-in/[[...sign-in]]/page.tsx` + `app/sign-up/[[...sign-up]]/page.tsx`（内置组件）
6. schema 加 `clerkId: text('clerk_id').notNull().unique()` 到 users，migrate
7. 写 `app/api/webhooks/clerk/route.ts`：
   - 读 header：`svix-id` / `svix-timestamp` / `svix-signature`
   - 用 `Webhook(CLERK_WEBHOOK_SECRET).verify(body, headers)` 验签
   - switch `event.type`：`user.created` → insert users 行；`user.deleted` → 删或标记
8. 本地测 webhook：两种方式任选
   - `cloudflared tunnel --url http://localhost:3000`（免注册）
   - ngrok（要账号）
   把 tunnel 的 URL 配到 Clerk dashboard 的 webhook
9. 真 sign-up 一次 → 看 Vercel log / 本地 console → 确认你 DB 里出现了新 user

**卡点思考**：
- 为什么验签失败时应该返回 400 而不是 401？对 Clerk 来说这两者有什么区别？
- 用户在 Clerk 侧的 email 改了，`user.updated` event 里你应该更新 DB 的哪些字段？哪些不该动？
- 如果 webhook 发送的那一刻你的服务器挂了，Clerk 会重试吗？你的代码要幂等吗？

## 今天结束能回答

- Clerk session 用什么机制（JWT / cookie / session store）？为什么 middleware 在 edge 能解析？
- 为什么 `user.created` webhook 可能在用户实际使用产品之前或之后到达？代码要怎么防御这种不确定？
- 如果有人拿到 webhook URL，直接 `curl -X POST` 伪造 `user.created`，你的代码会被骗吗？为什么？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 9）把 auth 融进业务逻辑 —— posts 要关联真实的当前 user
