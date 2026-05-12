# Next.js 缓存机制与刷新策略

## 核心结论

Next.js 15+ fetch **默认不缓存**。如果你用的是 Next.js 15+，大部分缓存问题不存在。

Next.js 13-14 默认缓存所有 fetch，需要手动管理缓存失效。

## router.refresh() 的原理

官方定义：向服务端发新请求，重新获取数据，重新渲染 Server Component，合并更新的 RSC payload，不影响客户端 state 和浏览器状态（滚动位置等）。**清的是客户端缓存（Router Cache），不是服务端缓存。**

```
1. router.refresh() 被调用
2. Next.js 客户端路由器发请求到当前 URL（可能带 ?_rsc 参数）
3. 服务端重新执行 Server Component（重新查数据库）
4. 返回新的 RSC payload（不是 HTML）
5. 客户端 React 拿到新 payload，和旧版本做 diff
6. 只更新 DOM 中变化的部分
7. 浏览器不刷新，不白屏，state 不丢
```

### 和浏览器 F5 的区别

```
浏览器 F5：
  → 请求：GET /users（document 类型）
  → 整个页面白屏重载，所有 state 丢失

router.refresh()：
  → 请求：GET /users?_rsc=xxxx（fetch 类型）
  → 静默更新，不白屏，state 不丢
```

### 和 revalidatePath 的区别

```
router.refresh()     → 清客户端缓存，只影响当前用户
revalidatePath()     → 清服务端缓存，影响所有用户
revalidateTag()      → 清服务端带特定标签的缓存，影响所有用户
```

## fetch 缓存系统（Next.js 13-14 默认开启，15+ 默认关闭）

### 缓存配置选项

```ts
// 不缓存（Next.js 15+ 默认行为）
fetch('/api/users', { cache: 'no-store' })

// 缓存（Next.js 13-14 默认行为）
fetch('/api/users', { cache: 'force-cache' })

// 按时间自动失效
fetch('/api/users', { next: { revalidate: 60 } })  // 60 秒

// 打标签，支持按标签失效
fetch('/api/users', { next: { tags: ['users'] } })
```

### 缓存失效方式

| 方式 | 代码 | 效果 |
|---|---|---|
| 时间失效 | `{ revalidate: 60 }` | 定时失效（stale-while-revalidate） |
| 按路径 | `revalidatePath('/users')` | /users 下所有 fetch 缓存失效 |
| 按标签 | `revalidateTag('users')` | 所有带 'users' 标签的缓存失效 |
| 全部失效 | `revalidatePath('/', 'layout')` | 根 layout 下所有缓存失效 |
| 客户端强制 | `router.refresh()` | 只清客户端缓存 |

### revalidateTag 的管理方式

给所有相关的 fetch 打同一个标签，mutation 时一行代码全部失效：

```ts
// 所有查 users 相关数据的地方
fetch('/api/users', { next: { tags: ['users'] } });
fetch('/api/dashboard', { next: { tags: ['users', 'dashboard'] } });

// mutation 时
'use server'
export async function createUser(data) {
  await fetch('/api/users', { method: 'POST', body: data });
  revalidateTag('users');  // 所有打 'users' 标签的缓存全部失效
}
```

## 只拦截 fetch，其他库不缓存

Next.js 通过 patch 全局 `fetch` 实现缓存。其他 HTTP 库绕过：

```ts
// 会被缓存
const res = await fetch('/api/users');

// 不会被缓存
const res = await axios.get('/api/users');
const res = await got('/api/users');
```

## Drizzle 直接查数据库 vs fetch API

```
Drizzle 直接查数据库：
  db.query.usersTable.findMany()
  → 不经过 fetch → 不进 Next.js 缓存系统
  → revalidateTag 用不了
  → 只能用 revalidatePath 按路径清缓存（麻烦）
  → 或用 router.refresh() / state 更新（推荐）

fetch 调用 API：
  fetch('/api/users', { next: { tags: ['users'] } })
  → 经过 fetch → 进缓存系统
  → revalidateTag 一行搞定
  → 适合外部 API 场景
```

## 全局关闭缓存

### Next.js 15+（不需要）

fetch 默认不缓存，无需处理。

### Next.js 13-14

```ts
// 方式 1：路由级别
// page.tsx 顶部
export const dynamic = 'force-dynamic';

// 方式 2：每个 fetch 单独关
fetch('/api/users', { cache: 'no-store' })

// 方式 3：全局覆盖 fetch（hack）
const originalFetch = globalThis.fetch;
globalThis.fetch = (...args) => {
  const [url, init] = args;
  return originalFetch(url, { ...init, cache: 'no-store' });
};
```

## 生产环境的缓存架构

Next.js 的 fetch 缓存是"开箱即用"的轻量方案，大项目通常用更成熟的方案：

```
请求进来
  → CDN 层（Cloudflare）→ 命中 → 直接返回
                       → 未命中 ↓
  → Next.js Server Component 渲染
    → fetch BFF API
      → Redis 缓存 → 命中 → 返回
                    → 未命中 ↓
      → 后端服务 → 数据库 → 返回
      → 结果写入 Redis（设 TTL）
```

| | Next.js fetch 缓存 | Redis / CDN |
|---|---|---|
| 可观测性 | 差，缓存存在内存里 | 好，有监控面板、命中率统计 |
| 分布式 | 每个实例各自缓存，不一致 | 集中式，所有实例共享 |
| 精确控制 | 只有 revalidate / tag / path | 任意 key、TTL、条件失效 |
| 调试 | 难，缓存行为隐式 | 透明 |
| 持久化 | 重启丢失 | Redis 可持久化 |

## 总结：Drizzle 直接查数据库的推荐方案

```
小项目 / 学习阶段：
  server action 返回数据 + useState 更新（最简单）
  或 router.refresh()（简单）

中项目：
  server action 里加 revalidatePath（按路径清缓存）

大项目 / 生产：
  用 Redis / CDN 做缓存，Next.js fetch 缓存关掉
```
