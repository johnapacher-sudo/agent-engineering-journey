# App Router API 路由（route.ts）

## 核心规则

API 路由的文件名**必须**是 `route.ts`（或 `.js`）。App Router 按**约定文件名**识别功能。

## 约定文件名一览

```
app/
├── page.tsx              → 页面路由（返回 JSX）
├── layout.tsx            → 布局包装
├── loading.tsx           → 加载状态
├── error.tsx             → 错误边界
├── not-found.tsx         → 404 页面
├── route.ts              → API 路由（返回 Response）
└── [...]/                → 动态路由段
```

## 关键规则

### 1. route.ts 和 page.tsx 不能共存

```
❌ 同一个目录下不能同时存在：
app/users/
├── page.tsx      ← 页面
└── route.ts      ← API 路由（冲突！）
```

一个路径要么是页面（返回 HTML），要么是 API（返回 JSON），不能同时是两者。

### 2. URL 路径规则

App Router 的 URL 路径 = 文件系统路径去掉 `app/` 和 `route.ts`：

| 文件路径 | URL 路径 |
|---|---|
| `app/api/users/route.ts` | `/api/users` |
| `app/user/list/route.ts` | `/user/list` |
| `app/webhook/stripe/route.ts` | `/webhook/stripe` |
| `app/sitemap.xml/route.ts` | `/sitemap.xml` |

`api/` 只是**人为约定的目录名**，不是框架自动加的。你完全可以把 API 路由放在任何目录。

### 3. 动态路由段

| 文件/目录 | 匹配 |
|---|---|
| `[id]/route.ts` | `/api/users/123` |
| `[[...slug]]/route.ts` | `/api/docs` 或 `/api/docs/a/b/c`（可选捕获） |
| `[...slug]/route.ts` | `/api/docs/a/b/c`（必填捕获） |
| `(group)/route.ts` | 不参与 URL 路径（仅分组） |

### 4. HTTP 方法函数

```ts
// app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const users = await db.select().from(usersTable);
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const [user] = await db.insert(usersTable).values(body).returning();
  return NextResponse.json(user, { status: 201 });
}

// 支持：GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
```

### 5. 动态路由 + 参数

```ts
// app/api/users/[id]/route.ts

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await db.select().from(usersTable).where(eq(usersTable.id, Number(id)));
  return NextResponse.json(user);
}
```

### 6. 返回响应的方式

```ts
// JSON
return NextResponse.json({ data: users });

// 带状态码
return NextResponse.json({ error: 'Not found' }, { status: 404 });

// 标准 Response
return new Response('Hello', { status: 200 });

// 重定向
return NextResponse.redirect(new URL('/login', request.url));

// 设置 Cookie
const response = NextResponse.json({ ok: true });
response.cookies.set('token', 'abc123', { httpOnly: true });
return response;
```

### 7. Edge Runtime

```ts
// app/api/edge-test/route.ts
export const runtime = 'edge'; // 'nodejs' | 'edge'

export async function GET(request: Request) {
  return Response.json({ runtime: 'edge', timestamp: Date.now() });
}
```

## 完整目录示例

```
app/
├── api/
│   ├── users/
│   │   └── route.ts              → GET|POST /api/users
│   ├── users/[id]/
│   │   └── route.ts              → GET|PUT|DELETE /api/users/123
│   ├── posts/
│   │   ├── route.ts              → GET|POST /api/posts
│   │   └── [slug]/
│   │       └── route.ts          → GET /api/posts/hello-world
│   └── webhook/
│       └── stripe/
│           └── route.ts          → POST /api/webhook/stripe
└── sitemap.xml/
    └── route.ts                  → GET /sitemap.xml
```

## App Router vs Pages Router API 路由对比

| | **App Router** (`route.ts`) | **Pages Router** (`pages/api/*.ts`) |
|---|---|---|
| 文件位置 | `app/api/xxx/route.ts` | `pages/api/xxx.ts` |
| 导出方式 | 导出 HTTP 方法函数（`GET`, `POST`...） | 导出默认 `handler` 函数 |
| 参数 | `(request: Request, { params })` | `(req: NextApiRequest, res: NextApiResponse)` |
| Request 对象 | 标准 Web API `Request` | Next.js 封装的 `NextApiRequest` |
| Response 对象 | 标准 Web API `Response` / `NextResponse` | `NextApiResponse`（Express 风格） |
| 运行时 | 默认 Node.js，可配 `runtime = 'edge'` | 默认 Node.js，Edge 需配 `config.runtime = 'edge'` |
| RSC 参与 | ❌ 纯 HTTP，不经过 React | ❌ 纯 HTTP，不经过 React |

## 选择建议

| 场景 | 推荐 |
|---|---|
| 新项目 | App Router `route.ts` |
| 需要 Edge Runtime | App Router（更自然） |
| 已有 Pages Router 项目 | 可以混用，新 API 用 `route.ts`，旧的不改 |
