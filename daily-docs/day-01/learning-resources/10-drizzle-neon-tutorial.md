# Drizzle + Neon 教程详解

把 Drizzle 概念落地成具体代码的完整流程：安装依赖 → 建数据库连接 → 定义表结构 → 配置 migration → 生成并执行 SQL → 增删改查。

## 第 1 步：安装依赖

```bash
# Drizzle 核心 + 命令行工具
pnpm add drizzle-orm
pnpm add -D drizzle-kit

# Neon HTTP 驱动
pnpm add @neondatabase/serverless

# 环境变量管理（drizzle.config.ts 里需要）
pnpm add dotenv
```

| 依赖 | 作用 |
|---|---|
| `drizzle-orm` | ORM 本体，提供 `pgTable`、`db.select()` 等 |
| `drizzle-kit` | 命令行工具，提供 `generate`、`migrate`、`push` |
| `@neondatabase/serverless` | Neon HTTP 驱动，连数据库用 |
| `dotenv` | 让 drizzle.config.ts 能读取 .env 里的 DATABASE_URL |

## 第 2 步：连接数据库

```ts
// src/db.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle({ client: sql })
```

### 两种驱动方式

```ts
// 方式 A：Neon HTTP 驱动（教程用这个）
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle({ client: sql })

// 方式 B：postgres.js TCP 驱动
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

两种效果一样，区别是 HTTP vs TCP（见 04-connection-pool.md）。

## 第 3 步：定义表结构（Schema）

```ts
// src/schema.ts
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users_table', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  email: text('email').notNull().unique(),
})

export const postsTable = pgTable('posts_table', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$onUpdate(() => new Date()),
})
```

### 常用字段修饰符

| 写法 | 含义 |
|---|---|
| `.notNull()` | 不能为空 |
| `.unique()` | 值在整张表里不能重复（如邮箱） |
| `.references(() => usersTable.id, { onDelete: 'cascade' })` | 外键 + 级联删除（用户删了，他的文章也删） |
| `.defaultNow()` | 插入时自动填当前时间 |
| `.$onUpdate(() => new Date())` | 更新时自动更新时间戳 |

### 类型推断

Drizzle 自动从表结构推断 TypeScript 类型，不用手写 interface：

```ts
export type InsertUser = typeof usersTable.$inferInsert
// { name: string; age: number; email: string }  （没有 id，id 自增）

export type SelectUser = typeof usersTable.$inferSelect
// { id: number; name: string; age: number; email: string }  （查出来有 id）
```

## 第 4 步：配置 drizzle-kit

```ts
// drizzle.config.ts
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env' })  // drizzle-kit 不走 Next.js，需要手动加载 .env

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### 为什么这里需要 dotenv

```
pnpm dev（Next.js 运行时）→ Next.js 自动读 .env，不需要 dotenv
pnpm drizzle-kit generate  → 普通Node.js脚本，不走 Next.js，需要 dotenv 手动加载
```

### process.env.DATABASE_URL! 里的 ! 是什么

TypeScript 的非空断言，告诉编译器"我确定这个值不是 undefined"。

```ts
process.env.DATABASE_URL      // 类型：string | undefined
process.env.DATABASE_URL!     // 类型：string（承诺它一定有值）
```

## 第 5 步：生成并执行 Migration

```bash
# 根据 schema.ts 生成 SQL 文件
pnpm drizzle-kit generate

# 执行 SQL，真正创建表
pnpm drizzle-kit migrate

# 或者直接 push（开发阶段快速迭代）
pnpm drizzle-kit push
```

生成的 SQL：

```sql
CREATE TABLE IF NOT EXISTS "users_table" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "age" integer NOT NULL,
  "email" text NOT NULL,
  CONSTRAINT "users_table_email_unique" UNIQUE("email")
);

ALTER TABLE "posts_table" ADD CONSTRAINT "posts_table_user_id_users_table_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users_table"("id")
  ON DELETE cascade ON UPDATE no action;
```

这就是 schema.ts 翻译成真实 SQL 的结果。

## 第 6 步：增删改查

教程把查询函数抽到 `src/queries/` 里：

```ts
// src/queries/insert.ts
import { db } from '../db'
import { InsertPost, InsertUser, postsTable, usersTable } from '../schema'

export async function createUser(data: InsertUser) {
  await db.insert(usersTable).values(data)
}

export async function createPost(data: InsertPost) {
  await db.insert(postsTable).values(data)
}
```

```ts
// src/queries/select.ts
import { asc, count, eq, getColumns, sql } from 'drizzle-orm'
import { db } from '../db'
import { usersTable, postsTable } from '../schema'

export async function getUserById(id: number) {
  return db.select().from(usersTable).where(eq(usersTable.id, id))
}

// 带分页 + 统计关联数据
export async function getUsersWithPostsCount(page = 1, pageSize = 5) {
  return db
    .select({
      ...getColumns(usersTable),
      postsCount: count(postsTable.id),
    })
    .from(usersTable)
    .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
    .groupBy(usersTable.id)
    .orderBy(asc(usersTable.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
}
```

每一个方法都能直接对应 SQL，这就是 Drizzle "SQL-like" 的设计。

## db 层的 'use server' 规则

db 层的所有文件（schema.ts、index.ts、queries/）都不需要 `'use server'`。

`'use server'` 只给 Server Action 用——从浏览器端调用的服务端函数。db 层是服务器内部模块，不涉及浏览器。

```
文件类型                       需要 'use server'？    原因
──────────────────────────────────────────────────────────
src/db/index.ts               不需要               服务器内部模块
src/db/schema.ts              不需要               服务器内部模块
src/db/queries/*.ts           不需要               服务器内部模块
app/users/page.tsx            不需要               Server Component 默认跑在服务器
app/users/create/actions.ts   需要                 浏览器要调用它
```

判断标准：这个函数会不会被浏览器端调用？会就需要 `'use server'`，不会就不需要。

## queries 在 Next.js 里的使用方式

### 方式 A：直接在 Server Component 里用（简单场景）

查询逻辑直接写在页面里，适合简单查询、页面不多的情况。

```tsx
// app/users/page.tsx
import { db } from '@/db'
import { usersTable } from '@/db/schema'

export default async function UsersPage() {
  const users = await db.select().from(usersTable)
  return <UserList users={users} />
}
```

### 方式 B：抽到 queries/ 里复用（推荐）

多个页面需要同一个查询，或查询逻辑复杂时，抽函数复用。

```ts
// src/db/queries/users.ts
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function getAllUsers() {
  return db.select().from(usersTable)
}

export async function getUserById(id: number) {
  return db.select().from(usersTable).where(eq(usersTable.id, id))
}
```

```tsx
// app/users/page.tsx
import { getAllUsers } from '@/db/queries/users'

export default async function UsersPage() {
  const users = await getAllUsers()
  return <UserList users={users} />
}
```

```tsx
// app/users/[id]/page.tsx
import { getUserById } from '@/db/queries/users'

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const [user] = await getUserById(Number(params.id))
  return <UserProfile user={user} />
}
```

### 方式 C：Client Component 通过 Server Action 触发写操作

Client Component 不能直接碰 db，通过 Server Action 做桥接。

```
Client Component（浏览器）
  │  点击按钮
  │  调用 Server Action
  ↓
Server Action（服务器）
  │  调用 db 层
  │  写数据库
  ↓
db 层（服务器内部）
```

具体写法：

```ts
// src/db/queries/users.ts（不需要任何标记）
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function deleteUser(id: number) {
  await db.delete(usersTable).where(eq(usersTable.id, id))
}
```

```ts
// app/users/actions.ts（需要 'use server'，浏览器要调用）
'use server'

import { deleteUser } from '@/db/queries/users'
import { revalidatePath } from 'next/cache'

export async function handleDeleteUser(id: number) {
  await deleteUser(id)
  revalidatePath('/users')  // 删完后刷新列表页的数据
}
```

```tsx
// components/user-card.tsx（'use client'，浏览器跑的 UI）
'use client'

import { handleDeleteUser } from '@/app/users/actions'

export function UserCard({ user }: { user: { id: number; name: string } }) {
  return (
    <div>
      <span>{user.name}</span>
      <button onClick={() => handleDeleteUser(user.id)}>
        删除
      </button>
    </div>
  )
}
```

### 分层总结

```
components/user-card.tsx    ← 'use client'  浏览器跑的 UI
       │ 调用
actions.ts                 ← 'use server'  浏览器→服务器的桥梁
       │ 调用
db/queries/users.ts        ← 无标记        服务器内部逻辑
       │ 调用
db/index.ts + schema.ts    ← 无标记        数据库连接和表结构
```

每层只做自己的事：

| 层 | 职责 | 跑在哪 |
|---|---|---|
| Client Component | UI 渲染 + 用户交互 | 浏览器 |
| Server Action | 接收浏览器请求，协调业务逻辑 | 服务器 |
| db queries | 具体的数据库操作 | 服务器 |
| db schema | 表结构定义 | 服务器 |

Server Action 是唯一需要 `'use server'` 的地方，因为它负责跨过浏览器和服务器的边界。其他层都在服务器内部，不需要标记。

如果以后把 queries 改了（比如从 Drizzle 换成 Prisma），Server Action 和 Client Component 都不用改，只改 db 层就行。

## 项目文件结构

```
├── src/
│   ├── db/
│   │   ├── index.ts         ← 数据库连接
│   │   ├── schema.ts        ← 表结构定义
│   │   └── queries/         ← 查询函数
│   │       ├── insert.ts
│   │       ├── select.ts
│   │       ├── update.ts
│   │       └── delete.ts
│   └── components/          ← 可复用 UI 组件
│       └── user-card.tsx
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── users/
│   │   ├── page.tsx         ← Server Component 读数据
│   │   ├── [id]/page.tsx
│   │   └── actions.ts       ← Server Action 写数据
├── migrations/               ← 自动生成的 SQL 文件
│   ├── meta/
│   └── 0000_xxx.sql
├── .env                      ← DATABASE_URL
├── drizzle.config.ts         ← drizzle-kit 配置
└── package.json
```
