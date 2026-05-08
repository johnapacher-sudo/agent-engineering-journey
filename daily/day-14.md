# Day 14 · 2026-05-21（周四）

> Week 2 · Auth + Payment
> 今天 1.5-2h · **周复盘日**

## 今天学什么

**主题**：Week 2 收官。

Week 1 我们建立了"数据怎么存、怎么查"。Week 2 建立的是"用户是谁、能用什么"。这两周加起来，你拥有了一个**有登录、有付费、有数据、能区分权限**的 SaaS 骨架 —— 这是所有 AI 产品的起点。

## 核心概念

今天要完成的心智动作：

- **产出验收**：Week 2 的 checklist 能不能全部指给我看？
- **口述三题**：不看文档，能把 Stripe 状态机、webhook 幂等、双写同步讲清楚。
- **模式提取**：Week 2 有三个反复出现的模式 —— **外部系统 + 本地同步 + webhook 桥接**（Clerk / Stripe / 后面的 Resend / Langfuse 都是这个形）。把它固化为心智模型。
- **Week 3 预判**：接下来是 Inngest 队列，预计 Week 2 哪些东西会再用到（transaction / webhook / 事件驱动）。

## 动手练习

### Part 1 · 产出验收（30 min）

打开项目，逐条对照 Week 2 最低产出：

**Auth 部分**
- [ ] Clerk sign-in / sign-up 页能用
- [ ] middleware 保护 `/posts` 路由
- [ ] webhook `/api/webhooks/clerk` 验签 + 处理 `user.created / updated / deleted`
- [ ] schema 有 `users.clerkId` unique
- [ ] `lib/auth.ts` 有 `getCurrentUser` / `requireUser` / `requireAdmin`
- [ ] posts 业务全部用 `requireUser()` 拿当前用户（不从 form 拿 userId）
- [ ] role 字段双写 Clerk `publicMetadata` 和 DB

**Payment 部分**
- [ ] Stripe Checkout 能付款（test mode）
- [ ] `/billing/success` 页正确（**不**在这里写 DB）
- [ ] webhook `/api/webhooks/stripe` 验签 + 处理 4 种 event
- [ ] schema 有 `subscriptions` 表
- [ ] `isPro(userId)` helper 单入口
- [ ] 3 处 paywall 落地（feature / usage / UI 提示）
- [ ] Customer Portal 能进入，能取消订阅

**笔记产出**
- [ ] `notes/stripe-subscription-state-machine.md`
- [ ] `notes/clerk-cheatsheet.md`
- [ ] `notes/webhook-reliability.md`

### Part 2 · 口述三题（30 min）

合上文档，录音或写逐字稿，每题**至少 4 分钟**：

1. **画 Stripe subscription 完整状态机**
   从 Checkout 点击 → 付款成功 → 续费 → 最终取消，中间可能经过 `incomplete / active / past_due / canceled / unpaid` 哪些 status？分别由哪些 event 触发？`cancel_at_period_end=true` 时 status 是什么？

2. **讲清 webhook 为什么要幂等**
   - 幂等的定义是什么？
   - Stripe / Clerk 为什么会重发？
   - 不幂等会在哪些具体场景出问题？
   - 你的代码里幂等是怎么实现的？（提示：`onConflictDoUpdate` / `event.id` 去重 / 写操作天然幂等）

3. **讲清 Clerk publicMetadata 和 DB role 双写的 race condition**
   - 你在 DB 里改 role，Clerk session 什么时候看到新值？
   - 两边不一致时谁是 source of truth？
   - 如果 webhook 丢了导致两边漂移，怎么修？（提示：有个叫 reconciliation job 的东西）

答得磕巴的题目，把对应的 `notes/` 重读一遍，明天晨间再口述一次。

### Part 3 · 抽象出模式（15 min）

在 `notes/patterns.md` 里记录你这两周**反复看到的模式**，建议三条：

**模式 1：外部系统 + 本地 DB 同步**
- 外部系统持有权威数据（Clerk 的 user / Stripe 的 subscription）
- 本地 DB 持有业务关联（userId 主键、业务字段）
- 通过 webhook 单向同步（外部 → 本地）
- 用 `xxxId` 字段桥接（`clerkId` / `stripeCustomerId`）

**模式 2：验签的 webhook endpoint**
- 永远 `req.text()` 读 raw body
- 用对方提供的 secret 验签
- 失败返 400，成功返 200
- 处理逻辑幂等（通过 upsert 或 event id 去重）

**模式 3：单入口状态判定函数**
- 所有"X 是什么状态"的判断收敛到一个 helper（`isPro` / `requireUser` / 未来的 `canUseFeature`）
- 组合条件藏在函数内部，业务代码不 care 细节

**这三个模式后面 M3-M6 会反复出现**。记下来，下次遇到直接套。

### Part 4 · 周复盘（15 min）

写 `notes/week-02-retro.md`（用 Week 1 的模板）：

- 完成度 / 欠债
- 核心学到的 3 件事
- 踩的 3 个坑 + 共同根源
- 浪费时间的 1 件事
- **阶段评估**：Clerk 阶段 1/2 ✓；Stripe 阶段 1/2 ✓；两者都不进阶段 3（对齐 ROADMAP_6M 的技术清单）
- Week 3 预判：Inngest 队列会用到 webhook 模式、transaction、事件驱动

## 今天结束能回答

- 过去两周你建立的这套骨架，离一个"能收钱的 SaaS"还差什么？（想 3 件事）
- Week 1+2 里最"反直觉"的一个知识点是什么？（只选一个）
- 如果让你给别的前端同事讲"2 周速成 SaaS 后端"，你的**大纲**会是什么？（这是将来博客的雏形）

## 晚上 10 min

- `journal.md` 最后一行：**Week 2 完成，Week 3 预备**
- push 所有 `notes/`
- 休息
- 明天是 Week 3 Day 1，主题 Inngest hello world —— Week 2 的 webhook 经验会在这里重新出现
