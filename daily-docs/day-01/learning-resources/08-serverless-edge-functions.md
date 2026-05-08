# Serverless Functions 与 Edge Functions

这两个是 Vercel（部署平台）提供的两种运行环境，不是 Next.js 的功能，也不是数据库的概念。

## 分三层理解

```
Next.js（框架）        → 定义了"怎么写代码"
  ↓
Vercel（部署平台）     → 定义了"代码跑在什么环境"
  ↓
Neon（数据库服务）     → 定义了"数据存在哪"
```

Next.js 不知道代码跑在 Serverless 还是 Edge 上，它只管路由和渲染。Serverless Functions 和 Edge Functions 是 Vercel 平台提供的运行环境。

## Serverless Functions

前端类比：普通的 Node.js 后端接口。

```ts
// app/api/users/route.ts
import { db } from '@/db'
import { users } from '@/db/schema'

export async function GET() {
  const allUsers = await db.select().from(users)
  return Response.json(allUsers)
}
```

特点：
- 跑在标准 Node.js 环境
- 支持所有 npm 包（包括 pg、postgres 等 TCP 驱动）
- 冷启动较慢（几百毫秒）
- 通常跑在某一个区域

## Edge Functions

前端类比：跑在 CDN 节点上的轻量接口。

```ts
// app/api/hello/route.ts
export const runtime = 'edge'

export async function GET() {
  return Response.json({ message: 'Hello from edge!' })
}
```

特点：
- 跑在 V8 引擎（不是完整的 Node.js），类似 Cloudflare Workers
- 冷启动极快（几毫秒）
- 全球分布，请求路由到最近的节点
- 限制多：不支持 TCP 连接、不能用 pg/postgres 驱动、部分 npm 包不兼容

## 对比

| | Serverless Function | Edge Function |
|---|---|---|
| 运行环境 | 完整 Node.js | 轻量 V8（类似浏览器） |
| 冷启动 | 几百毫秒 | 几毫秒 |
| 全球分布 | 单区域 | 多个 CDN 节点 |
| 能用 TCP 连数据库 | 能 | 不能 |
| 能用 Neon HTTP 驱动 | 能 | 能 |
| npm 包兼容性 | 几乎全部 | 受限 |

## 为什么 Neon 教程提到这两个

因为在不同环境下连数据库的方式不同：

```
Serverless Function → 可以用 TCP 驱动
Edge Function       → 只能用 Neon HTTP 驱动（因为 Edge 不支持 TCP）
```

这是平台限制导致的数据库连接方式不同。如果部署到自己的服务器，没有这些区分，全是 TCP 连接。

## 默认行为和切换方式

Server Component、Server Action、API 路由默认都是 Serverless Function（Node.js 环境）。加一行 `export const runtime = 'edge'` 就切换为 Edge Function（V8 环境）。

```ts
// 默认 → Serverless Function（Node.js）
'use server'
export async function addUser(formData: FormData) { ... }
```

```ts
// 加一行 → Edge Function（V8）
'use server'
export const runtime = 'edge'
export async function addUser(formData: FormData) { ... }
```

这个设定也决定了能用什么数据库驱动：

```
默认 Serverless → TCP 驱动（postgres / pg）能用
加 edge          → 只能用 Neon HTTP 驱动（TCP 不支持）
```

## 今天用不到

今天的写法是 Server Component 直接 `await db.select()`，不需要写 API 路由。以后需要 API 接口时用 Serverless Function（默认就是），只有在需要极低延迟、全球分布的场景才考虑 Edge Function。
