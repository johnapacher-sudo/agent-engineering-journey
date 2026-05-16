# 11 · App Router 的 import 边界：next/navigation vs next/router

> 上下文：写 NextButton 时 import 了 `useRouter from "next/router"`，运行时报 `NextRouter was not mounted`。这是 App Router 项目最容易踩的隐蔽 bug，**TS 不报错、ESLint 不警告，运行时才炸**。

---

## 5 秒结论

**App Router 项目（`app/` 目录）下，永远只用 `next/navigation`，永远不要用 `next/router`。**

```ts
// ❌ Pages Router 的（旧）
import { useRouter } from "next/router";

// ✅ App Router 的（新）
import { useRouter } from "next/navigation";
```

---

## 为什么 Next.js 同时存在两个 useRouter

Next.js 13 引入了 App Router，但**没有删除** Pages Router——保留兼容。结果：

| import path | 来源 | 适用 |
|---|---|---|
| `next/router` | Pages Router 时代（`pages/` 目录） | 老项目继续用 |
| `next/navigation` | App Router 时代（`app/` 目录） | 新项目用这个 |

两者**API 表面看起来很像**：

| 能力 | next/router (Pages) | next/navigation (App) |
|---|---|---|
| `useRouter()` | ✓ | ✓ |
| `router.push(href)` | ✓ | ✓ |
| `router.back()` | ✓ | ✓ |
| `useSearchParams()` | ✗（用 `router.query`） | ✓ |
| `usePathname()` | ✗（用 `router.pathname`） | ✓ |
| `router.events` | ✓ | ✗（移除） |

**"看起来差不多"是陷阱**——只有在 App Router 项目里 import `next/router` 才会运行时炸。

---

## 报错 `NextRouter was not mounted` 是什么意思

Pages Router 的 useRouter 内部依赖一个全局的 **`NextRouter` Context**，由 `_app.tsx` 自动挂载。

App Router 项目根本不用 `_app.tsx`、不挂载这个 Context。所以：

```
你的 client component
  ↓ useRouter()  (来自 next/router)
  ↓ 找 NextRouter Context
  ↓ Context = undefined
  ↓ throw "NextRouter was not mounted"
```

**报错出现的时机**：组件渲染时（不是 import 时）。所以：
- TypeScript 编译期：✓ 看不出
- ESLint 默认规则：✓ 不报警
- 服务端渲染：✓ 跳过（client only hook）
- 浏览器水合：✗ 渲染到这个组件就炸

---

## 为什么 TypeScript 拦不住

```ts
// next/router 的 useRouter 类型签名
export function useRouter(): NextRouter;

// next/navigation 的 useRouter 类型签名
export function useRouter(): AppRouterInstance;
```

两个**都正确**，只是返回类型不同：
- `NextRouter` 有 `query`、`pathname`、`events`
- `AppRouterInstance` 有 `push`、`replace`、`back`

如果你只用 `router.push(href)`——两个都有这个方法、签名也兼容——TS **完全推不出**你 import 错了。

---

## 怎么避免再踩

### 方法 1：装 ESLint 规则（推荐）

`eslint-plugin-next` 现在有一条规则，但默认不开。手动配：

```js
// eslint.config.mjs
{
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'next/router',
        message: 'App Router 项目应使用 next/navigation 而不是 next/router',
      }],
    }],
  },
}
```

加上后，**只要 import `next/router` 就编译期报错**——彻底拦截。

### 方法 2：肌肉记忆

> 写 import 时，**from 后面是 `navigation` 才对**——是 `router` 就停下检查。

可以贴在屏幕上一段时间，直到形成手感。

### 方法 3：永远从 IDE 自动补全

VSCode / Cursor 的 auto-complete 在 App Router 项目里，输入 `useRouter` 通常**第一条建议就是 `next/navigation`**。手动改 import 时容易翻车，自动补全更安全。

---

## App Router 的 navigation API 速查

```ts
import {
  useRouter,        // 编程式导航
  useSearchParams,  // 读 URL query
  usePathname,      // 读当前路径
  useParams,        // 读动态路由参数 [id]
  redirect,         // server-only：硬重定向
  notFound,         // server-only：触发 404
} from 'next/navigation';

// useRouter 的方法
const router = useRouter();
router.push('/foo')       // 导航 + push history
router.replace('/foo')    // 导航 + replace history
router.back()             // 浏览器后退
router.forward()          // 浏览器前进
router.refresh()          // 重新拉 RSC（不刷新整页）
router.prefetch('/foo')   // 预取

// useSearchParams 是 ReadonlyURLSearchParams
const sp = useSearchParams();
sp.get('q')               // 拿单个
sp.getAll('tag')          // 拿数组
sp.toString()             // 全部字符串
```

注意 `useSearchParams` 返回的是**只读**的——不能 `sp.set(...)`。要改 URL：

```ts
const params = new URLSearchParams(sp.toString());  // 可写副本
params.set('q', 'react');
router.push(`?${params.toString()}`);
```

---

## 还有几对 import 容易混

| ❌ 旧 / 错 | ✅ 新 / 对 | 备注 |
|---|---|---|
| `next/router` | `next/navigation` | 这一条是本笔记主题 |
| `next/head` | App Router 用 `metadata` 导出 | App Router 不用 `<Head>` |
| `next/image` | `next/image` | 这个没变（注意 props 变了） |
| `next/link` | `next/link` | 没变（但 `<Link>` 不再需要 `passHref`） |
| `getServerSideProps` | Server Component / `dynamic = 'force-dynamic'` | App Router 范式变了 |
| `getStaticProps` | Server Component（默认静态） | 同上 |

---

## 一句话内化

> **`from 'next/router'` 在 App Router 项目 = 隐性炸弹**。
> TS 不报、ESLint 默认不拦、浏览器渲染时才炸。
> 装一条 `no-restricted-imports` 规则，永远拦住。

---

## Muscle Memory 关联

- 这条不是 muscle memory 第 1-10 条的核心，但属于「**framework migration 期间的隐性 bug 类型**」——React Server Components / Next App Router / Cloudflare Pages 这种"新旧 API 共存"的环境，类似坑会反复出现。
- 真实场景：未来你升级 React 19 / Vue 4 / Tailwind v5 时，会再次碰到"旧 API 仍能 import 但运行时表现变了"的同类 bug。今天形成的"看 import 路径"的本能习惯，是通用迁移技能。

---

## 相关笔记

- [10 · 分页 UI 实战](./10-pagination-ui-pattern.md)
- [03 · Server Component hooks 限制（day-03）](../../day-03/learning-resources/03-server-component-hooks-limits.md)
