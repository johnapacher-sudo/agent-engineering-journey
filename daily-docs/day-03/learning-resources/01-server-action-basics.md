# Server Action 学习笔记

## Server Action 的本质

被 `'use server'` 标记的函数会自动转成一个隐藏的 POST endpoint。客户端调用时 Next.js 帮你打包参数、发请求、反序列化结果。写的像函数调用，跑的还是 HTTP。

### 编译机制

```
编译时：Next.js 扫描 'use server' 标记的函数，给每个生成一个唯一 ID
       （基于文件路径 + 函数名的 hash）

调用时：客户端调用 like fn(arg1, arg2)
       → Next.js 序列化参数（React 自定义序列化协议，不是 JSON）
       → POST 请求，body 里带 action ID + 参数

服务端：根据 action ID 找到对应函数 → 反序列化参数 → 执行 → 返回结果
```

### 两端各自的产物

```
服务端 bundle:                    客户端 bundle:
┌─────────────────────┐          ┌─────────────────────┐
│ 原始函数体           │          │ function createPost() │
│ + action ID 注册表   │          │   → POST 请求桩      │
│                     │          │   → 只知道 action ID  │
│ await db.insert(...) │          │   → 不知道函数体      │
│ revalidatePath(...)  │          │                     │
└─────────────────────┘          └─────────────────────┘
```

客户端拿到的就是一个只负责"打包参数 + 发 POST + 解析结果"的代理函数。函数体在服务端，客户端一无所知。

### 序列化协议

参数和返回值使用 React 自定义的序列化协议，不是 JSON。支持 Date、Map、Set、FormData 等 JSON 不支持的类型。

## Client Component 调用 Server Action

这是最常见的用法，完全支持：

```tsx
// actions.ts
'use server'
export async function createPost(title: string) {
  await db.insert(postsTable).values({ title });
}
```

```tsx
// page.tsx — Client Component
'use client'
import { createPost } from './actions';

export function PostForm() {
  const handleClick = async () => {
    await createPost('Hello');
  };

  return <button onClick={handleClick}>提交</button>;
}
```

也可以直接用在 form 的 action 属性上，0 JS：

```tsx
// 纯 Server Component，不需要客户端 JS
export default async function PostsPage() {
  return (
    <form action={createPost}>
      <input name="title" />
      <button type="submit">提交</button>
    </form>
  );
}
```

## 两个请求的问题

Server Action 在网络面板里可能看到两个请求：

```
请求 1: POST /_next/.../action    → 执行 server action，返回结果
请求 2: GET  /当前页面              → 重新获取页面的 RSC payload
```

第二个请求是 `revalidatePath` / `revalidateTag` 触发的——Next.js 自动发的，不是手动 fetch。

开发模式下 React StrictMode 会双重调用，生产模式（`next build && next start`）下会消失。

## Response 格式

Server action 的 response 不是 JSON，是 RSC Payload（React Server Component 序列化格式）：

```
0:["$","div",null,{"children":["$","h1",null,{"children":"Hello"}]}]
1:D{"name":"createPost"}
```

能传输的不只是数据，还能传输组件。这样 action 执行完后可以直接返回更新后的 UI 片段。

## `revalidatePath` 和 `revalidateTag`

Next.js 的缓存失效机制。Server Component 渲染完页面后会缓存结果，数据变了需要手动刷新缓存。

### `revalidatePath` — 让某个路径的缓存失效

```ts
'use server'
export async function createPost(title: string) {
  await db.insert(postsTable).values({ title });
  revalidatePath('/posts');     // /posts 页面缓存作废，下次访问重新渲染
}
```

### `revalidateTag` — 让带某个标签的所有缓存失效

```ts
// 1. 数据获取时打标签
fetch('https://api.example.com/posts', { next: { tags: ['posts'] } });

// 2. action 里按标签失效
'use server'
export async function createPost(title: string) {
  await db.insert(postsTable).values({ title });
  revalidateTag('posts');       // 所有标记了 'posts' 的缓存全部失效
}
```

### 为什么需要手动失效？

Server Component 没有 state，数据在服务端渲染时查询。用户做了 mutation 后：
- 客户端 state 方案：`setState` 自动触发 re-render
- Server Component 方案：需要 `revalidatePath` 通知服务端"数据变了，重新渲染"
- `revalidatePath` 本质上就是 Server Component 世界里的 `setState`

### 缓存策略总结

| 场景 | 策略 | 需要手动？ |
|---|---|---|
| 数据很少变 | `revalidate: 3600`（1 小时） | 不需要 |
| 数据实时性要求高 | `cache: 'no-store'` | 不需要 |
| 用户操作后立刻更新 | `revalidatePath` / `revalidateTag` | 需要 |
| 页面是静态的（博客文章） | 构建时渲染，不缓存 | 不需要 |

## Progressive Enhancement 机制

`<form action={createPost}>` 在无 JS 环境下也能工作，原理：

1. **编译时**：Next.js 把每个 Server Action 编译成独立的 HTTP API 端点，分配唯一 action ID
2. **渲染时**：`<form action={createPost}>` 被渲染为标准 HTML form，action 指向该端点
3. **有 JS 时**：Next.js 拦截 submit 事件，用 `fetch` 发请求（`Content-Type: text/x-component`），可以做 client-side transition（无刷新）
4. **无 JS 时**：浏览器用原生 form POST（`Content-Type: application/x-www-form-urlencoded`）到那个端点，服务端照样执行 action，然后返回完整页面（有刷新）

关键：**Next.js 把 Server Action 变成了真正的 HTTP 端点**，原生 form 才能提交到它。不是魔法，是编译 + 约定。

## Network 面板实际观察

在 post list 页触发一次 create，Chrome Network 面板可以看到：

- **请求 URL**：当前页面路由地址
- **请求方法**：POST
- **请求头**：`Next-Action: <action-id>` — 这是 Next.js 识别 Server Action 调用的标志
- **Content-Type（有 JS）**：`text/x-component`（Next.js 自定义编码格式，不是标准 form 编码）
- **Content-Type（无 JS 降级）**：`application/x-www-form-urlencoded` 或 `multipart/form-data`（浏览器原生行为）
- **响应格式**：RSC payload（非 JSON），能看到类似 `0:["$@1",["development",null]]` 的结构化文本，是 React 的序列化协议（flight format），本质是服务端组件树的 diff

## throw Error vs return { ok: false }

| | `throw new Error(...)` | `return { ok: false }` |
|---|---|---|
| HTTP status | **500** | **200** |
| 触发 Next.js error boundary | 是 | 否 |
| `useActionState` 拿到的是 | error 对象 | 正常返回值 |
| 中间件/Sentry 等监控 | 会捕获到 500 错误 | 不会 |
| action 执行 | 立即中断，后续代码不执行 | 正常完成 |

**实践选择**：
- 预期内的业务错误（如"标题不能为空"）→ `return { ok: false, message: "..." }`，用户还能继续操作
- 不可恢复的错误（如数据库挂了）→ `throw`，让 error boundary 统一处理
- 两种对应不同的错误语义：**业务校验 vs 系统故障**

## `<form action>` vs `<button onClick>` 调用差异

| | `<form action={fn}>` | `<button onClick={fn}>` |
|---|---|---|
| Progressive enhancement | 支持（无 JS 可用） | 不支持（必须有 JS） |
| 表单字段收集 | 自动收集所有 form 内的 input | 需要手动传参 |
| `<input type="file">` 上传 | 自动处理 | 需要手动构造 FormData |
| 内置表单校验 | 自动触发（required、pattern 等） | 不会自动触发 |
| `useActionState` 配合 | 可用 | 需要自己管理 state |
| 自动 router refresh | **会**（不管有没有 revalidatePath） | **不会**（除非手动 revalidatePath 或 router.refresh） |

**Content-Type 修正**：两种方式在有 JS 环境下都是 `text/x-component`。Next.js 拦截了 form 的 submit 事件。只有在 JS 禁用时，`<form action>` 才降级为标准 form 编码。

**核心差异就两个**：progressive enhancement（无 JS 降级）和表单能力的自动整合（字段收集、校验、文件上传、自动 refresh）。

## Server Action vs 客户端 State 更新

两种更新 UI 的方式：

```tsx
// 方式 A：server action 返回值，存 state（少一次请求）
'use client'
function PostsPage() {
  const [posts, setPosts] = useState([]);
  const handleClick = async () => {
    const newPost = await createPost('Hello');
    setPosts(prev => [...prev, newPost]);
  };
}

// 方式 B：Server Component + revalidatePath
'use server'
export async function createPost(title: string) {
  await db.insert(postsTable).values({ title });
  revalidatePath('/posts');
}
```

方式 A 交互更新更直接，方式 B 首屏加载更快（服务端直接渲染带数据的 HTML，不等客户端 JS 和二次请求）。可以混合使用。

`revalidatePath` 更适合的场景：多个地方共享同一份数据（后台改了商品价格，前台商品页、列表页、搜索页都要更新），一个 `revalidateTag('products')` 全部刷新。

## Server Component 与客户端 JS 体积

Server Component 不送 JS 到客户端：

```
Server Component → 只输出 HTML，0 JS
Client Component → 输出 HTML + JS bundle
```

实际项目的 bundle 构成：

| 部分 | JS 体积 |
|---|---|
| Server Component 部分 | 0（表格、文章内容、静态布局） |
| Client Component 部分 | 有（按钮交互、表单验证、弹窗） |
| Next.js 运行时 | ~几 KB（路由、RSC 协议处理） |
| Server Action stub | 极小（一个 action 就几行 fetch 包装） |

核心卖点：组件在服务端渲染，不交互的部分不送 JS。传统 React SPA 是所有组件的 JS 都要送到客户端。

## 安全性

### 内置防护

| 防护 | 说明 |
|---|---|
| Action ID 不可预测 | 基于文件路径 hash，不是函数名明文 |
| 同源校验 | 内置 CSRF 防护，非同源请求会被拒绝 |
| 不执行任意代码 | 服务端只查找预注册的 action ID，不存在则报错 |

### 仍需手动做的

Action ID 在客户端 bundle 里是可见的（DevTools Sources 能搜到），安全模型不依赖它保密。输入校验是必须的：

```ts
'use server'
export async function createPost(formData: FormData) {
  const raw = formData.get('title');
  const title = z.string().min(1).max(200).parse(raw);  // Zod 校验
  await db.insert(postsTable).values({ title });          // 参数化查询
}
```

## 常见误区

1. **Server Action 必须是纯函数？** — 错。设计来有副作用的（写数据库、发邮件、调 API）
2. **Server Action 打到 Node 进程不合理？** — 和 API Route 没区别，都是 Node 处理。静态资源走 CDN
3. **客户端能看到函数体？** — 不能。客户端只有 stub，不知道实现
4. **能脱离页面直接调 action？** — 理论上可以构造请求但很难（自定义序列化 + 特定 headers + 同源校验）
