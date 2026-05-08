# Neon Quickstart with Next.js

## 整体流程

从零到跑通的 5 步：创建 Neon 数据库 → 连接 Next.js → 查数据 → 页面展示。

## 第 1 步：创建 Neon 项目

1. 注册 Neon 账号（免费）
2. 进入 Console → 点 New Project
3. Postgres version 选最新的
4. Neon Auth 不勾选（今天不需要）
5. 拿到连接字符串

```
postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

类似注册 Supabase 或 Firebase，创建项目拿到 API Key。

## 第 2 步：安装数据库驱动

Neon 支持三种驱动：

| 驱动 | 说明 | 选择 |
|---|---|---|
| `@neondatabase/serverless` | Neon 自己的 HTTP 驱动 | Day 5 再看 |
| `postgres` (postgres.js) | 轻量 TCP 驱动 | **今天用这个** |
| `pg` (node-postgres) | 老牌 TCP 驱动 | 也行 |

```bash
pnpm add postgres
```

## 第 3 步：保存连接字符串

```bash
# .env.local（Next.js 自动读取，不提交到 Git）
DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/neondb?sslmode=require
```

注意：`?sslmode=require` 不能漏，Neon 强制要求 SSL 加密连接。

## 第 4 步：在 Next.js 里连接数据库

### Server Component 直接查数据

```tsx
// app/page.tsx
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

export default async function Page() {
  const users = await sql`SELECT * FROM users`
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name} - {user.email}</li>
      ))}
    </ul>
  )
}
```

关键点：
- 组件跑在服务器上，不是浏览器
- `async function` 是合法的——Server Component 支持 async
- 浏览器里看不到 DATABASE_URL，看不到 SQL 查询

### Server Action 处理写操作

```ts
// app/actions.ts
'use server'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

export async function addUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  await sql`INSERT INTO users (name, email) VALUES (${name}, ${email})`
}
```

## 第 5 步：跑起来

```bash
pnpm dev
# 访问 localhost:3000
```

## 重要坑：缓存

Next.js 在生产构建时会把 Server Component 静态渲染，数据库查询只在构建时跑一次。

需要每次请求都拿最新数据时：

```tsx
export const dynamic = 'force-dynamic'
```

## 原生 SQL vs Drizzle

教程用原生 SQL，你今天用 Drizzle 替代查询层：

```ts
// 教程写法（原生 SQL）
const users = await sql`SELECT * FROM users`

// 你的写法（Drizzle ORM）
const users = await db.select().from(usersTable)
```

其他步骤（Neon 创建、连接字符串、.env.local、Server Component）完全一样。

## Postgres 版本选择

选最新的。不同版本的区别主要是性能优化和新 SQL 功能，基础 SQL 语句在所有版本里完全一样。

## Neon Auth

Neon 内置的用户认证服务（登录、注册、OAuth），类似 Clerk、NextAuth。今天不需要，等做用户系统时再开。
