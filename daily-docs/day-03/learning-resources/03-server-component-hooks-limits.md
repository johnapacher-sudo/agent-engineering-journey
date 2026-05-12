# Server Component 的 Hook 限制

## 哪些能用，哪些不能用

| Hook / API | Server Component | Client Component |
|---|---|---|
| `useState` | 不能 | 能 |
| `useEffect` | 不能 | 能 |
| `useCallback` | 不能 | 能 |
| `useMemo` | 不能 | 能 |
| `useRef` | 不能 | 能 |
| `useContext` | 能（部分） | 能 |
| `await`（异步数据） | 能 | 不能直接用 |
| `onClick` 等事件 | 不能 | 能 |
| `window` / `document` | 不能 | 能 |
| `localStorage` | 不能 | 能 |
| 直接访问数据库 | 能 | 不能 |

## 为什么不让用 — 因为 Server Component 不在浏览器跑

所有被禁止的 API 都依赖同一个前提：**组件在浏览器里持续活着。** Server Component 不满足这个前提——它渲染一次就结束了。

### `useState` — 没有后续更新

Server Component 在服务端渲染一次，输出 HTML，结束。没有"后续更新"的概念。用户点了按钮，state 变了，谁来重新渲染？服务端已经返回了 HTML，连接都断了。state 需要 React 在客户端持续跟踪和更新，但 Server Component 在客户端不存在。

### `useEffect` — 没有 DOM 挂载

useEffect 是"DOM 挂载后执行副作用"。Server Component 不产生 DOM（只产生 HTML 字符串），没有"挂载"这个环节。服务端没有浏览器环境，没有 DOM，effect 跑给谁看。

### `useCallback` / `useMemo` — 没有重新渲染需要优化

这些是"记住函数/值，避免不必要的重新渲染"。Server Component 只渲染一次，没有"重新渲染"需要优化。记住一个永远只用一次的东西没有意义。

### `useRef` — 没有跨渲染周期

ref 是"持有跨渲染周期不变的可变引用"，通常用来操作 DOM。Server Component 没有跨渲染周期（只渲染一次），也没有 DOM。

### 一句话总结

**所有依赖"组件在浏览器里持续活着"这个前提的 API，Server Component 都不能用。** Server Component 是一次性的 HTML 生成器，不是一个活着的组件实例。需要持续活着、需要响应用户交互、需要管理状态 → 加 `'use client'`。
