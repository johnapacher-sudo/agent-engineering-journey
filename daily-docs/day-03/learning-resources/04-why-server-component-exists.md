# 为什么 Server Component 被设计出来

## Pages Router SSR 已经能服务端渲染，为什么还需要 Server Component？

Pages Router 的 SSR 仍然把所有组件的 JS 送到客户端：

```
Pages Router SSR：
  getServerSideProps 在服务端拿数据
  → 数据传给组件
  → 组件渲染 HTML
  → 但组件的 JS 仍然全部打包到客户端
  → 客户端还要 hydrate（重新执行一遍 JS，绑定事件）
```

50 个组件组成的页面 → 50 个组件的 JS 全部送到客户端 → 其中 40 个根本不需要交互 → JS 完全是浪费。

## Server Component 的根本设计愿景

**让组件模型跨越服务端和客户端——同一个组件树里，有些只在服务端存在，有些在客户端运行。**

```
传统 React（包括 Pages Router）：
  所有组件 → 客户端 JS bundle → 全部下载、全部执行

Server Component 架构：
  <Layout>           ← Server Component，0 JS
    <Sidebar>        ← Server Component，0 JS
    <ArticleList>    ← Server Component，0 JS
      <ArticleCard>  ← Server Component，0 JS
    <SearchBox>      ← Client Component，有 JS（需要 onChange）
    <LikeButton>     ← Client Component，有 JS（需要 onClick）
  </Layout>
```

客户端只下载 SearchBox 和 LikeButton 的 JS。其余组件在客户端根本不存在。

## 和 Pages Router 的本质区别

| | Pages Router SSR | Server Component |
|---|---|---|
| 谁在服务端跑 | 只有数据获取（getServerSideProps） | 整个组件（渲染逻辑 + 数据获取） |
| 客户端收到什么 | HTML + 全部组件 JS（hydrate 用） | HTML + 只有 Client Component 的 JS |
| 组件能直接查数据库吗 | 不能，只能在 getServerSideProps 里 | 能，组件本身就是服务端代码 |
| hydrate 范围 | 整个页面 | 只有 Client Component 部分 |

Pages Router 是"服务端拿数据，客户端跑所有组件"。Server Component 是"组件本身就在服务端跑，客户端只跑需要交互的部分"。

## 三个实际优势

### 1. 首屏快

```
传统 SPA：
  下载空 HTML → 下载 JS → 执行 JS → 发 API 请求 → 等响应 → 渲染

Server Component：
  请求页面 → 服务端查数据 + 渲染 → 直接返回带数据的 HTML
```

用户看到内容的速度快了一整轮。

### 2. 直接访问后端资源

```tsx
// 传统方式：要写 API Route，再 fetch
// app/api/posts/route.ts → GET /api/posts → Response.json(posts)
// 客户端 fetch('/api/posts') → await res.json()

// Server Component：直接查
async function Page() {
  const posts = await db.query.posts.findMany();  // 完了
}
```

少写一层 API。

### 3. 不会泄露服务端代码

```tsx
async function AdminDashboard() {
  const secret = process.env.ADMIN_SECRET;  // 永远不会到客户端
  const data = await fetchInternalApi(secret);
  return <div>{data}</div>;
}
```

整个组件的代码都不会进客户端 bundle。

## 实际例子：电商商品页

```
Pages Router SSR：
  客户端下载：商品组件 JS + 评论组件 JS + 推荐组件 JS + 购物车组件 JS
  → 总 JS：~200KB

Server Component：
  商品信息 → 0 JS
  评论列表 → 0 JS
  推荐商品 → 0 JS
  购物车按钮 → Client Component，有 JS
  → 总 JS：~10KB
```

## 诚实的代价

Server Component 确实让架构变复杂了：
- 心智模型从"所有组件一视同仁"变成"每个组件都要想它在服务端还是客户端"
- 缓存要手动管理（revalidatePath）
- 调试更难（代码跑在服务端，console.log 看不到客户端）

如果项目不大、首屏性能不是痛点，用纯 Client Component + API Route 完全 OK。Server Component 是一个优化工具，不是必须品。React 团队的愿景是"让大项目也能用组件化开发但不牺牲性能"，但小项目用了反而增加复杂度。
