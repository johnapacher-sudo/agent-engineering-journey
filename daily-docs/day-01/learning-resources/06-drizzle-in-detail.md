# Drizzle 详解

## Drizzle 的四个核心能力

```
1. 定义表结构（Schema）
2. 连接数据库（Connection）
3. 查数据（Query）
4. 同步结构到数据库（Migration）
```

## 1. 定义表结构（Schema）

用 TypeScript 写表结构，每一个 `pgTable()` 对应数据库里的一张表：

```ts
// src/db/schema.ts
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core'

export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),       // 自增主键
  name: text('name'),                   // 文本字段
})

export const cities = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: text('name'),
  countryId: integer('country_id').references(() => countries.id),  // 外键
})
```

类比前端用 TypeScript 定义 interface，只不过这个 interface 同时也是数据库的真实表结构。

### 关键字段类型对照

| 数据库概念 | Drizzle 写法 | 前端类比 |
|---|---|---|
| 自增 ID | `serial('id').primaryKey()` | 自动生成的唯一 key |
| 文本 | `text('name')` | `string` |
| 整数 | `integer('age')` | `number` |
| 时间戳 | `timestamp('created_at')` | `Date` |
| 可空字段 | `text('name')` 不加 `.notNull()` | `string \| null` |

### schema 文件里有两类东西

```ts
// 1. 表定义（对应数据库里的物理表）
export const users = pgTable('users', { id: ..., name: ... })
export const posts = pgTable('posts', { id: ..., userId: ..., title: ... })

// 2. 关联关系定义（只存在于 TypeScript 代码里，数据库里没有对应物）
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))
```

关联关系不会生成额外的数据库表或字段，只是告诉 Drizzle "查 users 的时候，可以通过这个关系顺便带出 posts"。

## 2. 连接数据库（Connection）

```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

类似前端创建 axios 实例，整个项目复用。任何地方 `import { db } from '@/db'` 就能查数据。

## 3. 查数据（Query）

Drizzle 提供两种查法。

### 方式 A：SQL-like API（精确控制）

```ts
import { eq, and, like } from 'drizzle-orm'

// 基本查询
const allUsers = await db.select().from(users)

// 带 where
const alice = await db.select().from(users).where(eq(users.name, 'Alice'))

// 多条件
const result = await db.select().from(users).where(
  and(
    eq(users.email, 'test@test.com'),
    like(users.name, 'A%')
  )
)
```

每一行都能直接对应 SQL：

```ts
db.select().from(users).where(eq(users.name, 'Alice'))
// → SELECT * FROM users WHERE name = 'Alice'

db.select({ name: users.name, email: users.email }).from(users)
// → SELECT name, email FROM users
```

### 方式 B：Relational Query API（方便嵌套查询）

SQL-like 需要手写 join 并自己组装数据：

```ts
const result = await db.select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.userId))
  .where(eq(users.id, 1))
// 返回扁平数据，要自己组装
```

Relational Query 直接帮你组装好：

```ts
// 先定义关系
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

// 查询时一行搞定
const result = await db.query.users.findMany({
  with: { posts: true }
})
// 返回：[{ id: 1, name: 'Alice', posts: [{ title: '...' }, ...] }]
```

### 增删改

```ts
await db.insert(users).values({ name: 'Alice', email: 'a@b.com' })
await db.update(users).set({ name: 'Bob' }).where(eq(users.id, 1))
await db.delete(users).where(eq(users.id, 1))
```

## 4. 同步结构到数据库（Migration）

```bash
# 根据 schema.ts 生成 SQL 文件（generate 流派）
pnpm drizzle-kit generate

# 执行 SQL 文件，真正改数据库（migrate 流派）
pnpm drizzle-kit migrate

# 直接同步，跳过 SQL 文件（push 流派，开发用）
pnpm drizzle-kit push
```

配置文件告诉 drizzle-kit 你的 schema 在哪：

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
})
```

## 关联关系详解

### many(posts) 怎么匹配的

不是自动匹配的，靠两处信息拼在一起：

**第一处：表定义里的外键**

```ts
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title'),
  userId: integer('user_id').references(() => users.id),
  //     ↑ posts.user_id 指向 users.id
})
```

**第二处：关联关系定义**

```ts
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))
```

Drizzle 的匹配逻辑：

1. usersRelations 说："users 的 posts 关联到 posts 表"
2. Drizzle 去看 posts 表，找到 `userId: references(() => users.id)`
3. 发现 posts.userId → users.id，匹配上了
4. 查询时自动生成 `JOIN ... ON posts.user_id = users.id`

匹配不上会直接报错。有歧义时必须显式指定字段。

### one vs many

```
一对一（one）：    user ←→ profile     一个人一个档案
一对多（many）：   user ←→ posts       一个人多篇文章
```

查出来的数据结构不同：

```ts
// one → 返回单个对象或 null
// { id: 1, name: 'Alice', profile: { bio: '...' } }
// { id: 2, name: 'Bob',   profile: null }

// many → 返回数组（空数组而不是 null）
// { id: 1, name: 'Alice', posts: [{ title: '...' }, { title: '...' }] }
// { id: 2, name: 'Bob',   posts: [] }
```

用哪个取决于业务关系，不是随便选的。

## 整体数据流

```
你写 schema.ts（TypeScript 代码）
       │
       ├──→ drizzle-kit generate  →  生成 SQL 文件  →  drizzle-kit migrate  →  数据库表创建/修改
       │
       ├──→ drizzle-kit push      →  直接同步到数据库（开发用）
       │
       └──→ 代码里用 db.select() / db.insert() 等  →  查询/操作数据
```

## 典型项目文件结构

```
src/
  db/
    schema.ts      ← 定义表结构 + 关联关系
    index.ts       ← 创建 db 连接实例
  app/
    page.tsx       ← Server Component 里直接 await db.select()
drizzle/
  0001_xxx.sql    ← 自动生成的 migration 文件
  meta/            ← drizzle-kit 内部用的快照
drizzle.config.ts  ← drizzle-kit 的配置
.env.local         ← DATABASE_URL=postgresql://...
```
