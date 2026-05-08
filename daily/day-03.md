# Day 3 · 2026-05-10（周日）

> Week 1 · Postgres + Drizzle
> 今天 3-4h（周末深度日）

## 今天学什么

**主题**：Server Actions 作为 Next.js App Router 的写操作姿势 —— 不是新 API，而是新的心智模型。

作为前端，你习惯"写 API route、前端 fetch、处理 loading/error"。App Router 给你一条新路径：**Server Action 把写操作的 RPC 消失在语言层**。今天要理解的不是"怎么用 Server Action"，而是它背后的取舍：**类型端到端 vs HTTP 可见性 vs 缓存失效模型**。

## 核心概念

- **Server Action 的本质**：被 `'use server'` 标记的函数会自动转成一个隐藏的 POST endpoint，客户端调用时 Next 帮你打包参数、发请求、反序列化结果。你写的像函数调用，跑的还是 HTTP。
- **和 API Route 的关系**：Server Action 适合"表单提交、按钮操作"这类写路径；API Route 适合"需要 HTTP 语义的地方（webhook 接收、第三方调用、流式响应）"。不是替代，是分工。
- **`revalidatePath` / `revalidateTag`**：Next 的 data cache 失效机制。写完 DB 要告诉 Next "这个路径/标签的缓存脏了"，下次访问重新渲染。**这是 Server Action 相比 API Route 的隐藏成本**—你必须理解 Next 的缓存模型。
- **统一返回格式 `{ ok, data?, error? }`**：Server Action 可以抛错，但抛错的 UX 很差（要 error boundary）。约定返回结构，客户端判断 `ok` 后分支处理，UX 可控。
- **`revalidatePath` 的副作用边界**：它只影响 Next 自己的 data cache，不影响浏览器 cache、CDN cache、Redis cache。今天只管 Next 这一层，其他层 M5 Week 19 再深入。

## 参考资源

- **[Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)** — 官方文档，今天的主菜
- **[Data Fetching: Caching](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching)** — 配合理解 revalidatePath 的作用域
- **[Theo: Why Server Actions](https://www.youtube.com/results?search_query=theo+server+actions)** — 找一个 10-15min 视频听一下观点

## 动手练习

在 Day 2 项目上做完整 CRUD：

1. `app/posts/page.tsx`：server component 直接 `await db.select().from(posts).leftJoin(users...)`，渲染 list
2. `actions/posts.ts`（顶部 `'use server'`）：
   - `createPost(input)` → insert → `revalidatePath('/posts')` → 返回 `{ ok: true, data: post }`
   - `updatePost(id, input)` → update → `revalidatePath('/posts')` + `revalidatePath('/posts/' + id)`
   - `deletePost(id)` → delete → `revalidatePath('/posts')`
   - 全部 try/catch 包，错误返回 `{ ok: false, error: '...' }`
3. `app/posts/new/page.tsx`：form 用 `action={createPost}` 直接绑
4. `app/posts/[id]/edit/page.tsx`：form 调 `updatePost`
5. list 里每行加删除按钮：用 client component 包一层，`onClick` 调 `deletePost`
6. **关键一步**：在 post list 页开 Chrome Network 面板，触发一次 create。观察：
   - 请求的 URL / method / body 是什么？
   - Server Action 背后的 RPC 协议长什么样？
   - `revalidatePath` 是在这次 response 里生效还是下一次导航？

**卡点思考**：
- 为什么 form 的 `action={createPost}` 在未 JS 环境下也能工作？Next 做了什么 progressive enhancement？
- 如果 `revalidatePath` 写错了路径会怎样？UI 视觉上有什么症状？
- Server Action 里 `throw new Error(...)` 和 `return { ok: false }` 的 UX 差异？

## 今天结束能回答

- Server Action 和 API Route 在 HTTP 层本质差别是什么？什么场景必须选 API Route？
- `revalidatePath('/posts')` 会让 Vercel 边缘 CDN 的缓存失效吗？为什么？（这题 M5 Week 19 会再问一次）
- 同一个 Server Action 在 `<form action={}>` 和 `<button onClick={}>` 两种用法下，行为差异在哪？

## 晚上 10 min

- `journal.md`：aha / 疑问 / 想深挖
- commit & push（今天应该有 5+ commits）
- 看 Week 1 还剩 4 天，Day 4 要上 join 和分页 —— 今天 schema 里 4 张表的意义就体现了
