# revalidatePath × router.refresh：精确语义

> ⚠️ 这篇是对 `05-nextjs-caching-mechanism.md` 的**校正与深化**。  
> 05 里的说法 "revalidatePath = 服务端缓存 / router.refresh = 客户端缓存" 不够精确——实际行为更微妙。

## 一句话校正

**`revalidatePath` 不"刷新"任何东西。它只做一件事：在 cache 上贴"过期"标签。**

把它想成图书馆里"这本书已撤回"的标记——标记完之后，没人主动去拿，新书还是在仓库里。

## 两层缓存 + 两个动作

Next.js App Router 有**两层缓存**：

| 缓存层 | 位置 | 内容 |
|---|---|---|
| **Data Cache** | server 端 | `fetch()` / `unstable_cache` / RSC 渲染结果 |
| **Router Cache** | **client 端**（浏览器内存里） | 已访问过的 path 的 RSC payload |

你看到的"刷新页面" = **"标记失效"** + **"主动重拉"** 两步：

| 动作 | 在哪运行 | 干什么 |
|---|---|---|
| `revalidatePath('/crud')` | server 端调用 | **标记** `/crud` 在 server Data Cache + **client Router Cache** 失效 |
| `router.refresh()` | client 端调用 | **主动**让当前页面重新拉 RSC payload |

注意：**`revalidatePath` 在 Server Action 上下文里会同时影响两层缓存**——server cache 通过函数调用直接失效；client Router Cache 通过 Server Action 返回响应里的 revalidation 指令失效。

## 三种组合的实际表现

| 组合 | 当前页面会看到新数据吗 | 下次访问该 path 会看到新数据吗 |
|---|---|---|
| **只 `revalidatePath`，没 `router.refresh()`**（在 server action 内）| ✅ **会**（框架自动 refresh） | ✅ |
| **只 `router.refresh()`，没 `revalidatePath`** | ⚠️ 可能拉到的还是旧数据，因为 server Data Cache 没失效 | ❌ 还是旧的 |
| **两者都有** | ✅ | ✅ |
| **`<form action>` 提交**（Next.js 自动两个都做） | ✅ | ✅ |

## Server Action 调用方式对自动 refresh 的影响

**关键校正**：之前以为"onClick 调用 server action 必须手动 router.refresh"——**不完全对**。

| 调用方式 | 自动 refresh？ |
|---|---|
| `<form action={serverAction}>` | ✅ Next.js 框架自动 |
| `startTransition(() => serverAction())` | ✅ 自动（React 19 + Next.js 14+） |
| 直接 onClick → serverAction（不包 startTransition） | ⚠️ 取决于版本，建议显式 `router.refresh` |
| 普通 `fetch('/api/...')`（不是 server action） | ❌ 必须手动 `router.refresh()` |
| 调了 `revalidatePath('/A')` 但当前不在 /A | ❌ 必须导航或手动 refresh |
| 外部 trigger（WebSocket 推送）想刷新 | ❌ 必须手动 `router.refresh()` |

## 类比

- `revalidatePath` = 在公告板上贴"内容过期"标签
- `router.refresh()` = "我现在就去公告板看新内容"
- **Server Action + startTransition** = 框架自动帮你做两件事

## 实操推荐

虽然在 `startTransition + server action` 下 `router.refresh()` **理论上是冗余的**，但**仍建议显式写**，原因：

1. **防御性**：行为依赖框架版本，未来 Next.js 改了就坑
2. **可读性**：明示意图——"我这里要刷新页面"
3. **可移植**：以后改成普通 RPC 时不用想起来加

## revalidatePath 路径写错的症状

`revalidatePath('/posts')` 写成 `revalidatePath('/post')`：Server Action 执行成功，数据已写进数据库，但 UI 不刷新。和完全没写 `revalidatePath` 表现一样——因为这个路径的缓存从来没被标记失效过。

| 数据获取方式 | 手动刷新页面能看到新数据吗 |
|---|---|
| Drizzle 直连数据库（`db.select()`） | ✅ 每次渲染都查库，不在 fetch 缓存体系内 |
| `fetch` + `cache: 'no-store'` | ✅ 不缓存，每次重新请求 |
| `fetch` + 默认缓存（`force-cache` 或没写 cache） | ❌ 命中旧缓存，除非缓存自然失效 |

## revalidatePath 与 Vercel Edge CDN

**会失效。** `revalidatePath` 在 Vercel 上同时失效三层缓存：

```
客户端浏览器 → Vercel Edge CDN → Next.js 服务端缓存（Data Cache + Full Route Cache）
                            ↑
                   revalidatePath 全都管
```

原理：Vercel 的 CDN 不是独立于 Next.js 的通用 CDN，它是 Next.js 缓存体系的一部分。两套基础设施是集成的——调用 `revalidatePath` 时，Next.js 内部会向 Vercel 的 CDN API 发 purge 指令。跟 runtime 是 edge 还是 Node.js 无关，关键是部署在 Vercel 上。

### 自部署环境的处理

缓存体系还在，只是 CDN 层的自动联动没了：

| 层 | 是否可用 | 说明 |
|---|---|---|
| Next.js Data Cache | ✅ | `revalidatePath` 正常失效 |
| Next.js Full Route Cache | ✅ | 同上 |
| 前置 CDN（Nginx/Cloudflare） | ❌ 不自动失效 | 需要自己处理 |

**实际做法**：
- 不加前置 CDN：让 Next.js 自己管缓存，`revalidatePath` 够用（中小项目）
- 用 Cloudflare CDN：设较短的 `s-maxage`，或在 Server Action 里手动调 Cloudflare purge API
- 用 Nginx 反代：只缓存静态资源（`/_next/static/`），动态页面不缓存
- 大多数自部署项目的做法：CDN 只缓存静态资源，动态页面缓存交给 Next.js 的 Data Cache 体系

## 心法

1. **`revalidatePath` 让 cache 过期；`router.refresh` 让页面重拉**。两者解决不同问题。
2. **form action 是语法糖**（自动帮你 refresh）；onClick 风格手写两个最稳。
3. **当数据来源是 server props（RSC）时**：不要用 `useState(props)` 然后手动同步——这是反模式。让 server action + revalidatePath 自动 reconcile。
4. **WebSocket 推送等"非 server action 触发的更新"**：必须配合 `router.refresh()`。

## 自检题

1. 假设你的 server action 只调用了 `revalidatePath('/crud')`，没调 `router.refresh()`。用户点完按钮在 `/crud` 页面，**看到了新数据**——这是巧合还是必然？为什么？
2. 假设你的 server action 调用了 `revalidatePath('/admin/posts')`，但用户当前在 `/crud` 页面。用户会看到 `/crud` 数据被刷新吗？为什么？
3. 如果你的 mutation 不是 server action 而是普通 `fetch('/api/...')`，**`revalidatePath`** 这个工具能用吗？（提示：它在哪定义？）
