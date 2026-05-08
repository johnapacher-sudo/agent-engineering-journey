# Day 9 · 2026-05-16（周六）

> Week 2 · Auth + Payment
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：把 auth 从"保护路由"升级到"贯穿业务逻辑"—— current user、role、权限校验的工程模式。

Day 8 只做到"未登录跳 sign-in"，这是 auth 最浅的用法。今天要理解的是：**每个业务操作都隐含一个"当前用户是谁、他能干什么"的上下文**。这个上下文怎么拿、怎么传、怎么被滥用，是所有有用户系统的产品都要解决的。

## 核心概念

- **Current user 的两层**：
  - Clerk 侧：`await auth()` 拿 `userId`（Clerk 的 id），轻量，不查 DB
  - 你 DB 侧：`await getUser()` 通过 `clerkId` 查自己 users 表，重一点但拿得到 role、subscription 等业务字段
  - **什么时候用哪个**：保护路由用轻量版；业务逻辑用 DB 版
- **Helper 收敛模式**：`requireUser()` / `requireAdmin()` 写在 `lib/auth.ts`，所有 server action / page 都调这两个，不要在业务代码里直接写 `auth()`。好处：以后改 auth 策略只改一个地方。
- **Role 的双写同步**：DB 里存 `role: 'user' | 'admin'` 是为了业务查询方便（比如"所有 admin 用户"）；Clerk 的 `publicMetadata` 存 role 是为了客户端 session 里能拿到（不用查 DB）。**两边会漂移**，要定好 single source of truth（建议 DB 为准，写 DB 时同步到 Clerk）。
- **Server Action 里的权限失败**：`throw` 会触发 error boundary（UX 差），`return { ok: false, error: 'unauthorized' }` 更可控。但有些场景（比如直接访问路由）更适合 `redirect('/sign-in')`。
- **"我的 posts" 过滤是个陷阱**：别在前端加 `filter((p) => p.userId === currentUserId)`，要在 SQL 层 `WHERE user_id = currentUserId`。前端过滤是**安全漏洞**（数据已经发到客户端了）。

## 参考资源

- **[Clerk: Read session and user data](https://clerk.com/docs/references/nextjs/read-session-data)** — 15 min，重点看 `auth()` 和 `currentUser()` 差异
- **[Clerk: Metadata](https://clerk.com/docs/users/metadata)** — 10 min，理解 public/private/unsafe metadata
- **[Next.js: Authentication patterns](https://nextjs.org/docs/app/building-your-application/authentication)** — 15 min

## 动手练习

1. **写 auth helper** `src/lib/auth.ts`：
   ```ts
   import { auth, currentUser } from '@clerk/nextjs/server'
   import { db } from '@/db'
   import { users } from '@/db/schema'
   import { eq } from 'drizzle-orm'

   export async function getCurrentUser() {
     const { userId: clerkId } = await auth()
     if (!clerkId) return null
     const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId))
     return user ?? null
   }

   export async function requireUser() {
     const u = await getCurrentUser()
     if (!u) throw new Error('UNAUTHORIZED')
     return u
   }

   export async function requireAdmin() {
     const u = await requireUser()
     if (u.role !== 'admin') throw new Error('FORBIDDEN')
     return u
   }
   ```

2. **改造 posts 业务**：
   - `createPost`：不从 form 拿 userId，内部 `const user = await requireUser()` 自动用
   - list 页加 "我的 posts" toggle：带 `?mine=1` 时 `WHERE user_id = user.id`
   - update/delete：检查 `post.userId === user.id`，非本人拒绝

3. **加 role 字段**：
   - schema 加 `role: text('role', { enum: ['user', 'admin'] }).notNull().default('user')`
   - migrate
   - 在 Clerk dashboard 手动把你自己的 publicMetadata 设成 `{"role": "admin"}`
   - 写 `app/admin/page.tsx` 用 `requireAdmin()` 守卫

4. **双写同步**：写一个 `updateUserRole(userId, role)` helper —— 同时 `db.update(users)` 和 Clerk 的 `clerkClient.users.updateUserMetadata(clerkId, { publicMetadata: { role } })`

5. **故意破坏看反应**：
   - 用浏览器 devtools 改掉 `mine=1` URL 参数强制看别人的 posts list → 你的 SQL 过滤在吗？
   - 用 B 账号的 session 发 `deletePost(A的post.id)` → 拒绝了吗？

**卡点思考**：
- 为什么 Clerk 的 `publicMetadata` 叫 "public" —— 客户端 JS 也能读吗？那 role 存这里安全吗？
- `requireUser()` 在 server component 里抛错，UI 会是什么样？能不能改成更友好的方式？
- 如果 webhook 创建 DB user 失败了，但 Clerk 那边用户已经存在，下次登录会怎样？你的 `getCurrentUser()` 返回什么？

## 今天结束能回答

- `auth()` 和 `currentUser()` 在 Next.js server 端的性能差异是什么？各自什么场景用？
- `publicMetadata` / `privateMetadata` / `unsafeMetadata` 三者差异？role 应该存哪个？
- 在双写 role 的系统里，DB 和 Clerk 不一致时（比如 webhook 丢失）怎么兜底？谁是 source of truth？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push
- 明天（Day 10）上 Stripe Checkout —— 你的第一个"真付费 $5" 体验
