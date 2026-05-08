# Day 28 · 2026-06-04（周四）

> Week 4 · Streaming + 错误处理
> 今天 1.5-2h · **周复盘日**

## 今天学什么

**主题**：Week 4 收官，同时也是 M1 主要内容的结尾。

过去 4 周你建立的东西：
- Week 1：数据层
- Week 2：用户 + 付费层
- Week 3：时间 / 异步层
- Week 4：流 / 错误 / 限流层

**这四层就是一个现代全栈 SaaS 的完整骨架**。M1 Day 29-30 主要是验收和承上启下，Week 4 做完今天意味着"学习内容"层面你已经打完了后端补课。明天开始验收，然后进 M2 LLM 内功。

## 核心概念

今天要完成的心智动作：

- **产出验收**：Week 4 的 checklist
- **口述三题**：SSE vs WebSocket、AbortSignal 全链路、错误分层
- **回看 M1 全景**：四周串起来是什么画面
- **M2 心理准备**：下周是 LLM 原理 + 裸 API，需要的前置心态

## 动手练习

### Part 1 · Week 4 产出验收（20 min）

**Streaming**
- [ ] 手写 SSE route 不依赖 EventSource，纯 fetch + reader
- [ ] 客户端有"取消"按钮，server 能感知
- [ ] 用 Suspense 做 2 处组件级 streaming 渲染
- [ ] 用 `useOptimistic` + `useTransition` 至少一处（点赞之类）

**AbortController**
- [ ] AbortSignal 在 browser → fetch → server route 全链路打通
- [ ] Inngest function 能被 `cancelOn` event 中止
- [ ] 长任务用 `AbortSignal.timeout` 做兜底

**错误体系**
- [ ] `AppError` 基类 + `UserError` / `SystemError` / 特化子类
- [ ] `wrapAction` envelope helper 所有 Server Action 统一用
- [ ] Sentry 接入 + `beforeSend` 过滤 UserError
- [ ] `withRetry` helper 用在外部 API（Resend / Stripe 等）

**滥用防护**
- [ ] `idempotency_keys` 表 + `withIdempotency` helper
- [ ] Stripe checkout 用了 idempotency
- [ ] Upstash Redis rate limit（per-user / per-ip / costly 三层）
- [ ] 至少 3 处 endpoint 有 rate limit

**笔记产出**
- [ ] `notes/sse-lifecycle.md`
- [ ] `notes/abort-signal-propagation.md`
- [ ] `notes/nextjs-cache-layers.md`
- [ ] `notes/error-boundary-coverage.md`

### Part 2 · 口述三题（30 min）

每题 4-5 分钟：

1. **SSE vs WebSocket 的选型判据**
   - 给三个具体场景，分别选什么：LLM 流式回复 / 多人协作文档 / 股票实时价格
   - 为什么 agent streaming 几乎必然选 SSE？
   - SSE 的断线重连机制是什么？和 WebSocket 比哪个更好？

2. **AbortSignal 从浏览器按钮到 Anthropic API 的完整链路**
   - 浏览器 → Next.js route → Anthropic SDK，每一跳怎么传？
   - 哪些环节可能"断链"？怎么验证？
   - 如果 Inngest function 想取消，机制完全不同 —— 为什么？

3. **错误分层体系的落地**
   - UserError / SystemError 怎么划分？给 8 个例子分类
   - Server Action 的 envelope 模式为什么比 throw 更好？
   - 什么场景 Sentry 不该上报？（提示：UserError）

### Part 3 · 提取 Week 4 的模式（20 min）

追加 `notes/patterns.md`：

**模式 7：面向失败设计**
- 任何外部依赖（DB / HTTP / 队列 / 邮件 / LLM）调用都会失败
- 失败处理三问：retriable 吗 / 怎么上报 / 用户看到什么
- 统一抽象：try/catch → 分类错误类型 → envelope / retry / Sentry 三路处理

**模式 8：取消语义的层次**
- Browser 层：AbortController
- HTTP 层：request.signal
- 长任务层：cancel event / cancelOn
- 业务层：状态标记（is_canceled）
- 每层都要独立工作，任一层失败不影响其他层

**模式 9：防滥用的三件套**
- 幂等（idempotency key）：防同一操作重复执行
- 限流（rate limit）：防高频滥用
- 鉴权（auth）：防无权访问
- 三件套是 Web 服务的"防线纵深"

这三个模式在 M2-M6 **反复出现**，每一次你遇到新东西（LLM 调用 / tool use / agent loop / MCP server）都要先问"这三件事怎么落"。

### Part 4 · M1 全景复盘（30 min）

不是周复盘，是**四周整体回看**。写 `notes/m1-panorama.md`：

**M1 四周主线**
- Week 1 数据层：**存得住、查得快**
- Week 2 身份层：**认得出、管得住**
- Week 3 时间层：**跑得起、失败能重试**
- Week 4 流/错层：**推得出、坏了不炸**

**一个应用的生命周期里这四层各自的角色**：用户打开页面（Week 2 认证）→ 页面数据从 DB 来（Week 1）→ 用户点按钮触发异步任务（Week 3）→ 进度实时推送回 UI（Week 4 SSE）→ 失败了优雅降级（Week 4 错误体系）

**这套骨架缺什么**？M5 会补：
- 观测性（看得见正在发生什么）
- 长任务架构（>5 分钟的任务怎么活）
- 缓存策略（快且便宜）
- MCP / API 集成层（对外开放）

**这套骨架 M2 要如何演化**？加 LLM 能力 —— 不是重写，是在 Server Action 里调 LLM、在 Inngest step 里 streaming token、用 AbortSignal 取消 LLM、用 AppError 分类 LLM 错误。**M1 的每一层都会被 M2 复用**。

### Part 5 · 周复盘（20 min）

`notes/week-04-retro.md`：
- 完成度 / 欠债
- 核心学到 3 件事
- 踩的 3 个坑 + 共同根源
- 阶段评估：Streaming 阶段 1/2 ✓；Error handling 阶段 1/2 ✓；Upstash ratelimit 阶段 1 ✓
- M2 预判：Week 5 要裸 HTTP 调 Anthropic Messages API + 手写 SSE parser。Week 4 的 SSE 经验会**直接**用到；错误体系要扩展到 LLM 错误（hallucination / refusal / 截断）；AbortSignal 要接 Anthropic SDK

## 今天结束能回答

- M1 四周的主线故事是什么？用一句话概括
- 进 M2 前，你最**担心**的是什么？最**期待**的是什么？
- 如果让你给资深前端写一篇"4 周速成全栈后端"的博客大纲，会分几章？

## 晚上 10 min

- `journal.md` 最后一行：**Week 4 完成，M1 主要内容完成**
- push 所有 notes
- 好好休息
- 明天 Day 29 整体 M1 通过判据自检（Day 29-30 原有内容已对齐，不需重写）
