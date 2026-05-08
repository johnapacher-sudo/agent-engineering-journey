# M1 · 后端工程基础（Day 1-30）

> 起始：2026-05-08（周五） · 结束：2026-06-06（周六）
> 主题：Postgres + Auth + Queue + Streaming，不碰 LLM
> 上层文档：[../ROADMAP_6M.md](../ROADMAP_6M.md)

---

## Week 1 · Postgres + Drizzle（05-08 → 05-14）

| Day | 日期 | 周几 | 主题 |
|---|---|---|---|
| 1 | 2026-05-08 | 五 | Next.js + Neon + Drizzle 启动 |
| 2 | 2026-05-09 | 六 | Schema 设计 + seed |
| 3 | 2026-05-10 | 日 | Server Actions CRUD |
| 4 | 2026-05-11 | 一 | Join + cursor 分页 + transaction |
| 5 | 2026-05-12 | 二 | Neon serverless driver + pooling |
| 6 | 2026-05-13 | 三 | Drizzle docs 精读 + 自检 |
| 7 | 2026-05-14 | 四 | Week 1 产出验收 + 周复盘 |

## Week 2 · Auth + Payment（05-15 → 05-21）

| Day | 日期 | 周几 | 主题 |
|---|---|---|---|
| 8 | 2026-05-15 | 五 | Clerk 接入 + webhook sync |
| 9 | 2026-05-16 | 六 | Roles + auth helper |
| 10 | 2026-05-17 | 日 | Stripe Checkout |
| 11 | 2026-05-18 | 一 | Stripe webhook 4 种事件 |
| 12 | 2026-05-19 | 二 | Billing portal + paywall |
| 13 | 2026-05-20 | 三 | Stripe docs 精读 + 自检 |
| 14 | 2026-05-21 | 四 | Week 2 产出验收 + 周复盘 |

## Week 3 · 队列与事件驱动 / Inngest（05-22 → 05-28）

| Day | 日期 | 周几 | 主题 |
|---|---|---|---|
| 15 | 2026-05-22 | 五 | Inngest hello world |
| 16 | 2026-05-23 | 六 | Event-driven 欢迎流 |
| 17 | 2026-05-24 | 日 | Retry + step.run 幂等 |
| 18 | 2026-05-25 | 一 | Cron + concurrency + throttle + batch |
| 19 | 2026-05-26 | 二 | 端到端异步 pipeline |
| 20 | 2026-05-27 | 三 | Inngest docs 精读 + 自检 |
| 21 | 2026-05-28 | 四 | Week 3 产出验收 + 周复盘 |

## Week 4 · Streaming + 错误处理（05-29 → 06-04）

| Day | 日期 | 周几 | 主题 |
|---|---|---|---|
| 22 | 2026-05-29 | 五 | 手写 SSE（不用库） |
| 23 | 2026-05-30 | 六 | React Suspense streaming |
| 24 | 2026-05-31 | 日 | AbortController 全栈打通 |
| 25 | 2026-06-01 | 一 | AppError 体系 + Sentry |
| 26 | 2026-06-02 | 二 | Idempotency key + Upstash ratelimit |
| 27 | 2026-06-03 | 三 | SSE / Streaming 规范精读 + 自检 |
| 28 | 2026-06-04 | 四 | Week 4 产出验收 + 周复盘 |

## Week 5 · 月度收官（06-05 → 06-06）

| Day | 日期 | 周几 | 主题 |
|---|---|---|---|
| 29 | 2026-06-05 | 五 | M1 通过判据自检 + 产出打磨 |
| 30 | 2026-06-06 | 六 | M1 月度复盘 + M2 预习 |

---

## M1 通过判据（D30 对照）

- [ ] 能默写 Postgres 事务 ACID 含义
- [ ] 能画出 Stripe subscription 4 种 webhook 的状态机
- [ ] 能讲清楚 SSE vs WebSocket 的选型判据
- [ ] 最低产出：一个 Next.js 应用，含 auth + DB + queue + streaming + Stripe，部署到 Vercel 能访问
