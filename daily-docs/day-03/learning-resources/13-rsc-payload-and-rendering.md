# RSC Payload 成本与大列表优化

## 一句话结论

Server Action 完成后浏览器收到的**不是 HTML，是 RSC payload**——序列化的 React tree。Next.js 通过 **partial rendering** 让"重传整个页面"变成"只传变了的部分"。但**大列表场景下 RSC 仍有真实传输成本**，需要工程上的优化。

## Server Action 后浏览器收到什么

不是 HTML 字符串，也不是 JSON 数据，是个紧凑的特殊二进制格式：

```
0:["$","main",null,{"children":[...]}]
1:I["app/crud/page",{"size":42}]
2:["$","article",null,{"children":[...]}]
...
```

## Partial Rendering：Next.js 不重传整个页面

| 部分 | 重传吗 | 解释 |
|---|---|---|
| 没变的 Server Component 子树 | ❌ | 命中 Data Cache，跳过 |
| 变了的 Server Component | ✅ | 只重传这部分 |
| Client Components | ❌ | client state 完全保留，不重新挂载 |
| 静态资源 / fonts / CSS | ❌ | 由 HTTP cache 处理 |

## 真实痛点：大列表越来越大

例：`/crud` 页面有 1000 条 post，每条 1KB → RSC payload 1MB+。每次 add 一条 post → 重传 1MB+。

**这是 RSC 架构的真实代价**。Next.js 提供 5 个工具应对：

### 1. `revalidateTag` 替代 `revalidatePath`（细粒度失效）

```ts
// ❌ 粗粒度：整个 /crud 页面 cache 失效，1000 条 post 都要重渲染
revalidatePath('/crud');

// ✅ 细粒度：只让 tag "posts" 失效，没标 "users" 的 cache 不动
revalidateTag('posts');
```

配合 `unstable_cache` 给"users 列表"和"posts 列表"分别 tag。

### 2. 分页 / Cursor

```tsx
// 不要一次拉 1000 条
<PostList posts={await getPosts({ limit: 20, offset })} />
```

新增一条 post → 只重传当前页 20 条。

### 3. `<Suspense>` 流式分块

```tsx
<Suspense fallback={<Skeleton />}>
  <PostList />  {/* 慢的部分单独 stream */}
</Suspense>
```

RSC payload **流式**传输——浏览器能边收边渲染，不必等完整 payload 到齐。

### 4. Client Component 自管局部 state

**频繁变化、不需要 server 持久化**的子树，索性别用 RSC：

```tsx
// 比如无限滚动 feed
'use client';
const { data } = useInfiniteQuery(...);
```

RSC 不是万能锤，**选对工具**。

### 5. 只 revalidate 子树而不是整条 path

```ts
revalidatePath('/crud', 'page');    // 只 page 级别
revalidatePath('/crud', 'layout');  // layout 级别
```

## 我个人的取向

**RSC 适合**："读多写少、数据有缓存价值"的页面（博客、商品列表、文档）

**RSC 不适合**："高频写入、强实时性"的场景（聊天、协作文档、股票面板）—— 用 Client Component + WebSocket / SWR 更舒服

## 心法

1. **RSC payload ≠ HTML，是序列化 React tree**——比 HTML 紧凑，但不是无成本。
2. **partial rendering 不是免费的**——只有变了的子树跳过，但变了的子树要完整重传。
3. **大列表 + 频繁写入是 RSC 的弱项**：**5 个工具**（tag、分页、Suspense、Client 自管、子树 revalidate）需要工程师**有意识地选择**。
4. **不要为了"现代化"强用 RSC**——选对工具更重要。

## 自检题

1. 假设你的 `/crud` 页面有 10000 条 post，每次 add 一条都 `revalidatePath('/crud')`。**RSC payload 大小**和**用户感知延迟**会怎样？
2. 如果改用 `revalidateTag('posts')` + 给 posts 单独 `unstable_cache`，能解决什么问题？还有什么遗留问题？
3. 一个聊天室页面，每秒可能有 10 条新消息。**用 RSC 还是 Client Component**？为什么？
