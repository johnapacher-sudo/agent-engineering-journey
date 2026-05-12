# Server Action vs API Route

## Server Action 和 API Route 的关系

Server Action 不是 API Route 的替代，是分工：

| | Server Action | API Route |
|---|---|---|
| 本质 | Next.js 内部 RPC | 标准 HTTP 接口 |
| 谁能调 | 只有 Next.js 客户端 | 任何客户端 |
| 适合 | Server Component 表单、简单 mutation | Webhook、第三方调用、流式、标准 REST |
| 返回格式 | RSC Payload（非标准） | 自定义（通常 JSON） |

CRUD 放哪都行，没有谁更合理。Server Action 是给 Next.js 生态内部用的 RPC 通道，API Route 是对外的标准接口。

### HTTP 层本质差别

| | Server Action | API Route |
|---|---|---|
| HTTP method | 仅 POST | GET / POST / PUT / DELETE 等 |
| 路由标识 | action ID（编译生成） | URL 路径（开发者定义） |
| 请求 Content-Type | `text/x-component`（自定义协议） | 标准 JSON / form-data |
| 响应格式 | RSC payload（非标准） | 自定义（通常 JSON） |
| CSRF 保护 | 自动（Origin 校验） | 需要手动加 middleware |
| 可脱离页面调用 | 理论上可以但很难 | 天然支持 |

### 必须选 API Route 的场景

- **第三方 webhook/callback**（如 Stripe）：对方发的是标准 HTTP 请求，没有 action ID
- **移动端 / 非 Next.js 客户端**：无法生成 RSC 协议
- **需要 GET 请求**：Server Action 只支持 POST
- **WebSocket 升级 / 流式响应**：Server Action 不支持
- **公开 API（给外部开发者用）**：需要稳定的 URL、版本管理、JSON 响应

## "分工"的设计意图

Server Action 存在的原始动机：**Server Component 没法用传统方式提交表单。**

```
Server Component 出现之前：
  表单提交 → onClick → fetch('/api/posts') → 没问题 ✅

Server Component 出现之后：
  表单提交 → ??? → 没有 JS，没有 onClick → 怎么提交？❌
```

`<form action={fn}>` 是 HTML 原生能力，不需要 JS，Server Component 可以直接用。Server Action 就是为了解决这个问题。

API Route 必须保留，因为有些场景 Server Action 做不了：

- **Webhook**：第三方回调只认标准 URL（如 Stripe、GitHub）
- **移动端/外部服务**：它们不知道 React 序列化协议，只能调标准 REST
- **流式响应**：Server Action 不原生支持

## 流式响应（Streaming Response）

服务端生成一点返回一点，不用等全部完成。典型场景：AI 逐字输出。

```ts
// app/api/chat/route.ts
export async function POST(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const words = ['你', '好', '，', '我', '是', 'AI'];
      for (const word of words) {
        controller.enqueue(new TextEncoder().encode(word));
        await new Promise(r => setTimeout(r, 500));  // 每 0.5 秒吐一个字
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

客户端边读边显示：

```ts
const res = await fetch('/api/chat', { method: 'POST', body: '...' });
const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  setText(prev => prev + decoder.decode(value));  // 逐字追加显示
}
```

## Client Component 里推荐用 Server Action 吗？

不是必须的。两种方式功能完全等价：

```tsx
// Server Action — 少写几行
const handleClick = async () => {
  await createPost(title);
};

// API Route — 语义更明确，更好调试
const handleClick = async () => {
  await fetch('/api/posts', { method: 'POST', body: JSON.stringify({ title }) });
};
```

Server Action 真正不可替代的场景就一个：Server Component 的 `<form action={fn}>`。其他场景用哪个是偏好问题。
