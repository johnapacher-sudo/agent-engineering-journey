# Next.js 核心概念：App Router、Server Component、Client Component、Server Action

## App Router vs Pages Router

Next.js 的两套路由系统，决定页面文件怎么组织。

### Pages Router（老方案）

```
pages/
  index.tsx        → 对应 /
  about.tsx        → 对应 /about
  users/
    [id].tsx       → 对应 /users/123
```

每放一个文件，自动生成一个路由。简单直接。

### App Router（新方案，2023 年推出）

```
app/
  layout.tsx       → 全局布局
  page.tsx         → 对应 /
  about/
    page.tsx       → 对应 /about
  users/
    [id]/
      page.tsx     → 对应 /users/123
```

用文件夹组织，每个文件夹下放 `page.tsx` 表示一个页面。

### 为什么要有新的

| 能力 | Pages Router | App Router |
|---|---|---|
| 嵌套布局 | 不支持 | 支持（layout.tsx 嵌套） |
| Server Component | 不支持 | 默认就是 |
| 流式渲染 | 不支持 | 支持 |
| 并行数据获取 | 不支持 | 支持 |

今天只用 App Router。

## Server Component（读数据）

App Router 里的组件默认就是 Server Component——跑在服务器上。

```tsx
// app/page.tsx
// 没有任何特殊标记，默认就是 Server Component
import { db } from '@/db'
import { users } from '@/db/schema'

export default async function Page() {
  const users = await db.select().from(users)
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

### 原理

组件在服务器上执行完，只把 HTML 发给浏览器：

```
服务器端：
  1. 执行 Page() 函数
  2. await db.select() 拿到数据
  3. 渲染成 HTML：<ul><li>Alice</li><li>Bob</li></ul>
  4. 把这段 HTML 发给浏览器

浏览器端：
  收到的是纯 HTML，没有 db.select()，没有数据库连接字符串
```

类似传统 PHP/JSP 或 SSR——服务器查数据、拼好 HTML，发给浏览器。

## Client Component（浏览器交互）

需要用户交互（点击、输入、状态）时，显式标记 `'use client'`：

```tsx
'use client'
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>点击了 {count} 次</button>
}
```

### 原理

还是会先在服务器上预渲染一遍 HTML，然后浏览器加载 JS 接管交互：

```
服务器端：渲染出 <button>点击了 0 次</button> → 发给浏览器
浏览器端：加载 JS → 接管 onClick、useState → 用户点击 → 重新渲染
```

就是传统的 React 水合（Hydration）。服务端给静态 HTML 骨架，浏览器加载 JS 后"激活"它。

## Server Action（写数据）

Server Component 解决了"读数据"，Server Action 解决"写数据"——浏览器触发的操作，实际跑在服务器上。

```ts
// app/actions.ts
'use server'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function addUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  await db.insert(users).values({ name, email })
}
```

```tsx
// app/page.tsx
'use client'
import { addUser } from './actions'

export default function Form() {
  return (
    <form action={addUser}>
      <input name="name" />
      <input name="email" />
      <button type="submit">提交</button>
    </form>
  )
}
```

### 原理

客户端根本没有执行服务端代码，它只是发了一个 HTTP 请求。

```
编译阶段：
  Next.js 看到 'use server'
  → 把 addUser 函数抽出来，部署到服务端
  → 在客户端代码里，把 addUser 替换成一个函数 ID

浏览器实际拿到的代码（伪代码）：
  const addUser = async (formData) => {
    return fetch('/__next/server-action', {
      method: 'POST',
      body: JSON.stringify({
        actionId: 'abc123',
        formData: serializeFormData(formData)
      })
    })
  }

运行时：
  用户点提交 → 浏览器发 POST → 服务器根据 actionId 找到函数 → 执行 → 返回结果
```

本质是 Next.js 帮你自动生成了 API 接口，省掉手写 `app/api/xxx/route.ts`。

## 四个概念的关系

```
Next.js
  ├── App Router（路由系统，用 app/ 文件夹组织页面）
  │     ├── Server Component（默认，跑在服务器，读数据渲染页面）
  │     ├── Client Component（'use client'，跑在浏览器，处理交互）
  │     └── Server Action（'use server'，跑在服务器，处理写操作）
  └── Pages Router（老路由系统，了解即可）
```

## 判断规则

| 需要什么 | 用什么 |
|---|---|
| 只展示数据，没有交互 | Server Component（默认） |
| 需要 useState、onClick、onChange | Client Component（'use client'） |
| 需要写数据库 | Server Action（'use server'） |
| 需要给前端 JS 或外部调用 | API 路由（app/api/） |

## 完整项目文件结构

```
src/
├── app/                          ← App Router（页面和路由）
│   ├── layout.tsx                ← 全局布局
│   ├── page.tsx                  ← 首页（Server Component）
│   ├── users/
│   │   ├── page.tsx              ← /users（Server Component，读数据）
│   │   ├── [id]/
│   │   │   └── page.tsx          ← /users/123（Server Component）
│   │   └── create/
│   │       ├── page.tsx          ← /users/create（Client Component，表单）
│   │       └── actions.ts        ← Server Action（处理表单提交）
│   └── api/                      ← API 路由（可选）
│       └── users/
│           └── route.ts
├── components/                   ← 可复用 UI 组件
│   ├── ui/                       ← 基础组件
│   ├── user-card.tsx             ← Server Component（纯展示）
│   └── user-form.tsx             ← Client Component（交互）
├── db/                           ← 数据库相关
│   ├── schema.ts                 ← Drizzle 表结构
│   ├── index.ts                  ← db 连接实例
│   └── queries/                  ← 查询函数（可选）
├── lib/                          ← 工具函数
└── types/                        ← TypeScript 类型
```

### 数据流

```
读数据：
  用户访问 /users → Server Component 执行 db.select() → 渲染 HTML → 发给浏览器

写数据（两种方式）：
  Server Action：用户提交表单 → 浏览器发请求 → 服务端执行 action → 写数据库
  API 路由：前端 JS 调 fetch('/api/users') → 服务端执行 handler → 写数据库

简单页面用 Server Action，复杂交互用 API 路由。
```
