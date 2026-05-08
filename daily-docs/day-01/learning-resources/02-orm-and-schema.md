# ORM 与 Schema as Code

## ORM 是什么

ORM（Object-Relational Mapping）就像数据库的 **SDK / API wrapper**。

前端类比：你平时调 API 不会手写 HTTP 请求，而是用封装好的函数。ORM 做的是同样的事——**把 SQL 查询封装成 TypeScript 函数调用**。

```ts
// 不用 ORM，手写 SQL（容易拼错，没类型提示）
await sql`SELECT * FROM users WHERE email = ${email}`

// 用 Drizzle ORM（类型安全，有自动补全）
await db.select().from(usersTable).where(eq(usersTable.email, email))
```

## Schema as Code

类似前端用 Zod 定义表单校验 schema，Drizzle 用 TypeScript 定义数据库表结构：

```ts
// 前端用 Zod 定义数据结构
const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
})

// Drizzle 定义数据库表结构
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

好处：数据库结构和 TypeScript 类型永远同步，不会出现"数据库改了字段但 TS 类型没改"的问题。

## Drizzle vs Prisma

两者都是 ORM，做同一件事，设计理念不同。

### 前端类比

| Prisma | Drizzle |
|--------|---------|
| Tailwind（约定大于配置） | CSS Modules（你知道自己在写什么） |
| 核心理念："你不需要懂 SQL" | 核心理念："你写的就是 SQL，只是用 TypeScript 写的" |

### 代码对比

Prisma 的方式：

```ts
// Schema 用自己的 .prisma 文件（不是 TypeScript）
// schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String
  name      String?
}

// 查询数据
const users = await prisma.user.findMany({ where: { name: "Alice" } })
```

Drizzle 的方式：

```ts
// Schema 就是纯 TypeScript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
})

// 查询数据——你能看出这对应什么 SQL
const users = await db.select().from(usersTable).where(eq(usersTable.name, "Alice"))
// 对应 SQL: SELECT * FROM users WHERE name = 'Alice'
```

### 关键区别

| | Prisma | Drizzle |
|---|---|---|
| Schema 文件 | 自己的 `.prisma` 语法，要学新语法 | 纯 TypeScript |
| 查询风格 | `prisma.user.findMany()` — 像 MongoDB | `db.select().from()` — 像 SQL |
| Bundle 大小 | 重（自带查询引擎，几十MB） | 轻（纯 JS） |
| Serverless 冷启动 | 查询引擎启动慢 | 快 |
| 类型推断 | 好，但需要 `prisma generate` | 好，天然就是 TypeScript |

### 为什么学 Drizzle

1. 部署到 Vercel（Serverless），Drizzle 更轻更快
2. 学数据库阶段，Drizzle 更贴近 SQL，能同时学会 SQL
3. Prisma 藏了太多细节，短期爽，长期不懂 SQL 会吃亏
