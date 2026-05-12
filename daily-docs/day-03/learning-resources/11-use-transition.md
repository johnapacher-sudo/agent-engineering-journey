# useTransition 深度：不只是"isPending"

## 一句话结论

`useTransition` 不只是"管 isPending 状态"。它的**真正价值是把状态更新标为"低优先级 transition"**，从而免费拿到 3 层能力：pending 状态 / 不阻塞输入 / 抢占式更新。

## 3 层价值，从浅到深

### 第 1 层：拿到 `isPending` 状态（最常用）

```ts
const [isPending, startTransition] = useTransition();
```

用来让按钮 disabled、显示 "提交中..."、防止连击。**如果只是这层**，确实跟自己写 `setLoading(true/false)` 没差别——这是初学者常见的误解。

### 第 2 层：低优先级调度（React 并发渲染）

React 内部有**并发渲染调度**。`startTransition` 包起来的更新被标记为 **transition**，意思是：

> "这次状态更新不紧急。如果有更紧急的事（用户输入、滚动），先处理紧急的，回头再处理我。"

**举一个能看出差异的场景**：

```tsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);

  const handleChange = (e) => {
    setQuery(e.target.value);  // ← 紧急：让 input 立刻响应

    // 渲染 5000 个搜索结果是 CPU 密集
    startTransition(() => {
      setResults(filterHugeList(e.target.value));  // ← 低优先级
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {/* 即使 results 还在渲染，input 始终丝滑 */}
      <ResultsList items={results} />
    </>
  );
}
```

| 写法 | input 体验 |
|---|---|
| 没有 transition | 每次 keystroke 都等 5000 行 results 渲染完 → 卡 |
| 有 transition | input 永远不卡，results 在后台慢慢更新 |

### 第 3 层：抢占式更新

如果 transition 还在渲染中，用户又触发了一次更新，React 会**丢弃**未完成的旧 transition，开始处理新的。

避免了"用户已经改输入了，旧搜索结果才慢慢出来"的问题。

## 跟 "直接 setLoading + await" 的对比

```ts
// ❌ 朴素写法
const handleClick = async () => {
  setLoading(true);
  await action();
  setLoading(false);
};

// ✅ Transition 写法
const [isPending, startTransition] = useTransition();
const handleClick = () => {
  startTransition(async () => {
    await action();
  });
};
```

| 差别 | 朴素 | Transition |
|---|---|---|
| 拿到 pending state | 自己管 `loading` state | 自动 `isPending` |
| 期间能否响应别的输入 | 看运气（UI 可能卡） | ✅ 永远丝滑 |
| 用户又触发了新 action | 两个 await 排队 | 旧的可能被抢占丢弃 |
| 跟 Server Action 整合 | 一般 | 完美（startTransition 自动触发 refresh） |
| 跟 useOptimistic 配合 | ❌ 不支持（useOptimistic 只能在 transition 内调） | ✅ 必须配 |

## React 19 新能力

React 19 起，`startTransition` 直接支持 `async function`：

```ts
// React 18：需要包一层
startTransition(() => {
  (async () => {
    await action();
  })();
});

// React 19：直接传 async
startTransition(async () => {
  await action();
});
```

## 心法

1. **简单 demo 里 `useTransition` 跟 `useState(loading)` 看起来一样**——这不代表它没用。真正价值在大列表 / 频繁触发 / 配合 useOptimistic 场景下才显现。
2. **养成用 transition 包 server action 的习惯**：免费拿调度优化、抢占、useOptimistic 兼容。
3. **transition 是 useOptimistic 的前置条件**——`setOptimistic` 只能在 transition 内调用。
4. **`startTransition` ≠ `setTimeout(0)`**：前者是 React 调度的语义标记，后者只是浏览器事件循环延迟。

## 自检题

1. `useTransition` 和 `useDeferredValue` 都让 UI "不卡"。它们的区别是什么？什么场景用哪个？
2. 为什么 `setOptimistic` 必须在 transition 内调用？（提示：transition 提供了"什么时候清空乐观队列"的信号）
3. 如果你在一个 transition 里**同时**调了 `setStateA` 和 `setStateB`，React 会一起 batch 还是分开 commit？
