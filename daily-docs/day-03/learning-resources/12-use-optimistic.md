# useOptimistic 深度：派生 state + 自动 reconcile

## 一句话结论

`useOptimistic` 不是"if pending then optimistic else base"的简单 if-else。它的本质是：

> **optimisticState = baseState + reducer 在 transition 期间累积应用的所有 setOptimistic 调用**

**它的回滚机制是"transition 结束 → 清空乐观队列 → 优雅回到 baseState"**——没有显式的 try/catch 也能自动处理成功/失败。

## 核心机制（精确版）

1. `useOptimistic(baseState, reducer)` 持有 `baseState`（真实状态）
2. 在 transition 内调用 `setOptimistic(value)` → reducer 应用到 optimistic 队列
3. transition 期间持续计算：`optimisticState = baseState + 队列里所有 reducer 应用`
4. **transition 结束（成功 OR 失败）→ 清空乐观队列**
5. 此时 optimistic = baseState

**"成功"和"失败"用户看到的差别**：

- 成功 = transition 结束**之前**你已经把 baseState 通过 `setX(real)` 更新到目标值 → 看起来"乐观值保留"
- 失败 = transition 结束时 baseState 没变 → 看起来"乐观值回滚"

**同一个机制处理两种 outcome**——这才是 useOptimistic 优雅的地方。

## 关键概念：optimistic 是否跟随 baseState 变化？

**取决于 reducer 是否使用 `state` 参数**：

| reducer 类型 | 写法 | baseState 变化时 |
|---|---|---|
| **覆盖型** | `(state, newAge) => newAge` | ❌ optimistic 不跟着变（忽略了 state） |
| **追加型** | `(state, c) => [...state, c]` | ✅ optimistic 跟着变 |
| **按 id 修改型** | `(state, c) => state.map(...)` | ✅ optimistic 跟着变 |

为什么？因为 reducer 本质是 `(currentInput, payload) => newOutput`。如果你写 `(s, v) => v`，等于**显式宣告"我不在乎 baseState"**——你的乐观值就跟 baseState 完全脱钩。

→ **reducer 形状是"乐观叠加策略"的开关**。

## 跟 useState 的本质区别

| 维度 | setState (useState) | useOptimistic |
|---|---|---|
| state 来源 | 自管 | 派生于 baseState，仅 pending 期临时叠加 |
| 失败回滚 | 手动 catch + 恢复原值 | 自动（transition 结束时 optimistic 队列清空） |
| 多个并发 transitions | 互相覆盖（race condition） | 各自队列独立 |
| 跟 server state 关系 | 必须手动 `useEffect` 同步 props | **baseState 来自 props 时自动 sync** |
| 适用场景 | 纯客户端状态 | 客户端乐观叠加 + server 是 source of truth |

**setState 真正做不到的场景**：当 baseState 来自外部（props / server / context）时。

```tsx
// ❌ useState 做乐观更新：
function PostList({ posts }) {
  const [localPosts, setLocalPosts] = useState(posts);
  // 问题：server revalidate 后 posts prop 变了，
  //       但 useState 只在 mount 时初始化，localPosts 跟 server 永远脱钩！
}

// ✅ useOptimistic：
function PostList({ posts }) {
  const [optPosts, addOpt] = useOptimistic(
    posts,  // ← baseState 是 props，server revalidate 后自动跟随
    (state, newPost) => [...state, newPost]
  );
}
```

## 实战：处理"server 生成字段未知"的场景

发评论 / 创建 post 时，id、createdAt 在 client 不知道。**用 placeholder + status 标识**：

```ts
const [optimisticComments, addOptimistic] = useOptimistic(
  comments,
  (state, newText: string) => [
    ...state,
    {
      id: `temp-${Date.now()}`,           // 临时 id
      text: newText,
      author: currentUser.name,
      createdAt: new Date(),
      status: 'sending' as const,         // 标识"乐观"
    },
  ]
);

const handleSubmit = (text: string) => {
  startTransition(async () => {
    addOptimistic(text);                 // UI 立刻插入"灰色 / 半透明"评论
    await createComment(text);
    // server action 返回 → revalidate → 真实 comments 从 server sync 回来
    // optimisticComments 自动消失，UI 自然替换
  });
};

return (
  <ul>
    {optimisticComments.map(c => (
      <li className={c.status === 'sending' ? 'opacity-50' : ''}>{c.text}</li>
    ))}
  </ul>
);
```

这是 Twitter / Slack / ChatGPT / iMessage 都用的模式。

## 高阶推理：实时协作 + 乐观更新

场景：实时协作 todo 列表
- server WebSocket 推送其他人的变化
- 你本地用 useOptimistic 做乐观添加
- 你 add 一个 todo，await 期间 server 推来别人的 todo
- 你的 add 失败回滚

**4 个时间点 UI 变化**：

| 时间点 | baseState | queue | optimistic |
|---|---|---|---|
| t0：add 前 | `[A,B,C]` | `[]` | `[A,B,C]` |
| t1：你点 add D | `[A,B,C]` | `[(D)]` | `[A,B,C,D]` |
| t2：server 推来 E | `[A,B,C,E]` ← baseState 变 | `[(D)]` | `[A,B,C,E,D]` ← reducer 重新应用 |
| t3：add 失败 | `[A,B,C,E]` | `[]` ← queue 清空 | `[A,B,C,E]` |

**核心 insight**：transition 结束 = 清空队列 = optimistic 自动回到 baseState。**不需要 try/catch、不需要记录 originalState**。

## 并发 setOptimistic 行为

| 行为 | 含义 |
|---|---|
| **覆盖型 reducer**（如 `(s, v) => v`）+ 并发 transition | **会 race**，结果不可预测 |
| **追加型 reducer**（如 `(s, v) => [...s, v]`）+ 并发 transition | ✅ 不 race，操作 commutative |
| **按 id 修改型 reducer**（如 `(s, v) => s.map(...)`）| ✅ 不 race，针对不同 id |

**工程实践**：
1. 设计 reducer 让它对调用顺序不敏感（commutative / idempotent）
2. 覆盖型乐观更新配 UI 限制（按钮 disabled / debounce）
3. 不要依赖并发 setOptimistic 的精确顺序

## 适合 / 不适合的场景

| 场景 | 适合度 |
|---|---|
| 点赞 / 收藏 / follow | ⭐⭐⭐⭐⭐ |
| Todo 增删 | ⭐⭐⭐⭐⭐ |
| 评论发送 | ⭐⭐⭐⭐ |
| 删除消息 | ⭐⭐⭐⭐ |
| 编辑文本（即时保存） | ⭐⭐⭐ |
| 提交订单 / 支付 | ❌ 钱必须等 server 确认 |
| 用户名注册 | ❌ 有唯一性冲突 |
| 上传大文件 | ❌ 用进度条 |

**3 个条件全部满足才用 optimistic**：
1. 用户体验上"快"比"准"重要
2. Server 失败率 < 5%
3. 失败后 UI 回滚后果可接受

## 完整 mental model

```
        ┌──────────────────────────────────────┐
        │  Server / Props / Context            │
        │  (Source of Truth)                   │
        └────────────────┬─────────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────────┐
        │  baseState (传给 useOptimistic 的)    │
        │  - useState 持有                     │
        │  - 或 RSC props                      │
        │  - 或 context value                  │
        └────────────────┬─────────────────────┘
                         │ (派生)
                         ▼
┌──────────────────────────────────────────────────────────┐
│  optimisticState                                         │
│  = baseState + queue of setOptimistic calls 应用 reducer  │
│                                                          │
│   ↑ transition 内 setOptimistic → queue.push             │
│   ↑ baseState 变化 → 重新计算                            │
│   ↑ transition 结束 → queue 清空 → optimistic = baseState │
└──────────────────────────────────────────────────────────┘
                         │ (渲染)
                         ▼
                    UI 看到的值
```

## 心法

1. **不是 if-else 逻辑，是"基底 + 队列叠加"模型**。
2. **reducer 形状决定是否跟随 baseState**：覆盖型脱钩，追加型同步。
3. **唯一让 optimistic 消失的方式**是 transition 结束 → queue 清空。
4. **baseState 来自外部（props / server）时 useOptimistic 无可替代** —— useState 必须手动 useEffect 同步是反模式。
5. **`setOptimistic` 必须在 transition 内调用**——transition 提供生命周期边界。

## 自检题

1. 一句话回答 "useOptimistic 跟 useState 的本质区别"。
2. 如果在 transition pending 期间，外部 setState 把 baseState 改了，且你用的是**覆盖型** reducer（`(s, v) => v`），optimistic 会跟着变吗？
3. 想一个**只能用 useOptimistic、setState 完全做不到**的场景。
