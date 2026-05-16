# Day 4 · 学习笔记索引

> 本目录是 Day 4 AI 问答学习的整理，围绕 **数据库复杂查询 + 生产级 Drizzle 实战** 五大主题展开：
> 1. 组合 filter 与 JOIN
> 2. 分页（cursor / 深翻页 / Elasticsearch）
> 3. 跨表原子操作（transaction / 隔离级别）
> 4. 生产级 Drizzle 查询架构（API 边界、反向筛、type-safe filter、CQRS-lite）
> 5. **页面级实战（分页 UI、App Router 边界、Transaction 三铁律、批量扁平化）**

## 目录

### Part 1：复杂查询基础
1. [01-组合条件 Filter（带 JOIN）](./01-composite-filter-with-join.md) — 多表关联 + WHERE 组合筛选
2. [02-Cursor-Based 分页](./02-cursor-based-pagination.md) — Offset vs Cursor 对比、锚点定义、深翻页优化方案
3. [03-Elasticsearch 深翻页方案](./03-elasticsearch-deep-pagination.md) — ES 架构、数据同步、搜索引擎扛深翻页

### Part 2：跨表事务与并发
4. [04-Transaction 跨表原子操作](./04-transaction-acid.md) — ACID 四要素、代码模板、Agent 场景
5. [05-隔离级别与 MVCC](./05-isolation-mvcc.md) — 四种隔离级别对比、为什么不直接用 SERIALIZABLE、MVCC 原理

### Part 3：生产级 Drizzle 查询架构
6. [06-Drizzle 两套查询 API：Relational vs Builder](./06-drizzle-relational-vs-builder.md) — 概念地图、各自适用场景、如何嵌套组合
7. [07-反向筛主表：subquery + inArray 模式](./07-reverse-filter-pattern.md) — 三种过滤语义对比、双层 where 独立性
8. [08-Type-safe Filter 抽象](./08-type-safe-filter-abstraction.md) — FilterMap + per-field handler、抽象的门槛、`as const satisfies`
9. [09-生产级 Query 架构](./09-production-query-architecture.md) — CQRS-lite、Repository 分层、DTO、JOIN row explosion 性能对比

### Part 4：页面级实战（Day-04 收官）
10. [10-分页 UI 实战：URL 即状态 + Pagination 组件](./10-pagination-ui-pattern.md) — 双查询拿 total、URL 同步、useTransition、智能省略号
11. [11-App Router 的 import 边界](./11-app-router-vs-pages-router-imports.md) — `next/navigation` vs `next/router` 的隐性炸弹、ESLint 拦截
12. [12-Transaction 三铁律：必 await、串行、不嵌套](./12-transaction-three-rules.md) — 5 个 bug 剖析、Drizzle tx 正确写法
13. [13-树形数据 → 批量扁平化：消除 5 层 for-of 嵌套](./13-tree-to-flat-batch-insert.md) — flatMap + Map + onConflictDoUpdate 模式，附 **PostgreSQL ON CONFLICT 三件套深入**（target / EXCLUDED / 4 个 UPSERT 配方）
14. [14-Neon 驱动选型：HTTP vs WebSocket](./14-neon-http-vs-websocket.md) — neon-http 不支持事务的根因、两种驱动对比、WebSocket 三约束、Drizzle 适配方案、决策指南
15. [15-如何阅读 Raw SQL 日志](./15-how-to-read-raw-sql.md) — 去掉 params 看骨架、识别事务边界、异常信号检测、SQL 基础要不要补
16. [16-Drizzle Relational columns 精确控制](./16-drizzle-relational-columns.md) — with + columns 只 select 需要的字段
17. [17-Day 4 自检题校验记录](./17-day4-self-check.md) — Cursor vs Offset 性能量化、with 生成独立 SELECT 非 JOIN、rollback 触发机制

---

## 核心心法速查

### Filter + JOIN
1. **组合条件 filter = JOIN + 多个 WHERE**：跨表关联提供数据桥接，WHERE 叠加筛选维度
2. **Agent 场景**：Memory 检索本质就是组合 filter + JOIN——按用户、时间、主题多维召回

### 分页（query 层）
3. **Offset 能跳页但深翻页慢**：逐行计数 O(offset + limit)，数据插入会偏移
4. **Cursor 用 WHERE + 索引跳转**：O(log N + limit)，不受数据插入影响，但只能上下页
5. **Cursor 快的前提是索引**：没有索引的 cursor 字段，WHERE 一样全表扫
6. **生产按场景分**：跳页用 Offset（限制深度），滚动加载用 Cursor
7. **电商深翻页方案**：子查询取 ID（优化 Offset）→ 预计算 Redis → ES 搜索引擎
8. **复合 cursor（排序字段 + id）**：处理 sort 列重复值，id 当 tiebreaker，(createdAt, id) 组合一定唯一

### Elasticsearch
8. **ES 直接返回 ID 列表**（不是 cursor 值），PG 用 `WHERE id IN (...)` 取详情
9. **ES 只存搜索/排序字段**（瘦索引），PG 存全量数据。各干各擅长的
10. **数据同步三种方式**：应用双写（简单但不一致）→ CDC 监听 WAL（最常用）→ 定时增量（有延迟）

### Transaction 基础
11. **原子性 = undo log 回滚**：任何一步失败，用 undo log 还原所有修改
12. **一致性 = A + I + D + 约束**：C 是结果要求，不是具体机制
13. **Agent 多步 Tool Call 必须包 transaction**：库存扣减 + 创建订单 + 支付记录，要么全成要么全败
14. **return = commit 已做的操作，throw = rollback 全部操作**
15. **自增 ID 回滚后跳跃是正常的**：序列递增不在事务保护范围内，是性能设计

### 隔离级别
14. **默认 READ COMMITTED 够用**：99% 场景不需要提高隔离级别
15. **并发写冲突用 `FOR UPDATE` 悲观锁**：不加隔离级别也能解决
16. **MVCC = 读看快照不阻塞，写用行锁互斥**：读写不互相阻塞
17. **SERIALIZABLE 性能差**：高并发下大量事务被 abort，吞吐量暴跌

### Drizzle API 边界
18. **Drizzle 有两套 API**：`db.query.X.findMany`（Relational，拿树形）vs `db.select().leftJoin()`（Builder，任意 SQL）
19. **它们不是互斥，是嵌套关系**：Relational 当外壳，Builder 在 `where` 里塞 subquery
20. **Builder 出来是扁平 row + 表名 namespace**：`{ users_table_3: {...}, posts_table_3: {...} }`，且有 row explosion
21. **Relational 出来是嵌套树**：自动去重，类型干净，是 80% 业务读场景的首选
22. **`with` 生成的不是 JOIN，是独立 SELECT + 内存组装**：分批查询避免 row explosion，嵌套多层 with 时优势尤其明显

### 反向筛模式
22. **"反向筛"有 3 种语义**：只过滤 tagsGroup（无用）、过滤 post（漏出空 user）、过滤 user + post（推荐）
23. **Subquery + `inArray` 是核心姿势**：`inArray(user.id, db.select({id: ...}).from(...).where(...))`
24. **Subquery 是 lazy 的**：不带 `await` 不会立即跑，会被内联到外层 SQL 的 `WHERE x IN (...)`
25. **嵌套 with 的每一层 where 是独立的**：不会自动级联——想要内外一致必须显式写两遍
26. **双 FilterMap**：USER_LEVEL_FILTERS 控制"哪些 user"，POST_LEVEL_FILTERS 控制"每个 user 拉哪些 post"

### Type-safe Filter 抽象
27. **`Object.entries(params).forEach(([k, v]) => eq(k, v))` 用不了**：字符串字段名跟 Drizzle Column 之间没映射，必须显式声明
28. **`and(undefined, undefined)` 安全**：返回 undefined，`.where(undefined)` 也安全
29. **2-3 字段不要抽象**：内联 `and(eq, eq)` 比 `buildFilterConditions` 更可读
30. **生产模式：FilterMap + per-field handler**：每个字段一个 lambda，封装"如何把这个字段转成 SQL"
31. **抽象门槛**：4+ 字段 / 多种操作符（eq + gte + ilike + in）/ 跨多个查询复用 → 才值得

### 生产 Query 架构
32. **CQRS-lite**：每个读用例一个独立 query 函数，不要"一个超级灵活的 getUserList 应付一切"
33. **入口必校验**：Zod schema parse → 类型 + 运行时双重保险
34. **三层架构**：action（解析 + 调用 + 包装）→ service（业务 + 权限 + 事务）→ repository（DB）
35. **DTO ≠ 替代品**：DTO 永远在那一层，问题只是它要不要兼职"分组"
36. **DB shape ≠ API shape**：DTO 负责重命名 / 派生 / 隐藏敏感字段
37. **少 SQL 次数 ≠ 性能好**：真正的瓶颈是 wire 传输 + app 内存
38. **JOIN row explosion**：1 user × 100 post × 10 tag = 1000 行，wire 200KB；Relational 只要 20KB
39. **大公司不做的事**：自动反射 filter / 一个 findEntity 应付一切 / 直接 return DB row / GraphQL 解决一切

### 页面级实战（Part 4 新增）

**分页 UI 三件套**
40. **状态在 URL 不在 React state**：刷新、分享、后退、收藏全免费
41. **双查询拿 total**：data 用 relational + count 用 builder，`Promise.all` 并发，**WHERE 必须一致**
42. **分页必须 orderBy**：没稳定排序，第 2 页可能重复或漏行
43. **`hasNextPage = offset + users.length < total`**：不是 `>`，写错就永远 disabled
44. **改 filter / 改 pageSize 自动回第 1 页**：避免"在第 5 页改筛选 → URL 还有 offset=20 → 显示空"
45. **router.push 必须保留其他 URL 参数**：`new URLSearchParams(searchParams.toString())`，不能空开始
46. **useTransition 让 router.push 异步可视化**：自动 isPending、按钮 disabled、防竞态

**App Router import 边界**
47. **App Router 永远用 `next/navigation`**：`next/router` 是 Pages Router 时代，App Router 项目运行时炸 `NextRouter was not mounted`
48. **TS 拦不住这个 bug**：两边都有 `useRouter` export 且签名相似，编译期看不出
49. **装 `no-restricted-imports` 永久拦截**：ESLint 配 `next/router` 为禁止 import

**Transaction 三铁律**
50. **必 return / await**：没 return = fire-and-forget，事务在后台异步跑、错误进 unhandled rejection
51. **永远 for...of + await**：tx 内单连接，`Promise.all` 不是优化是 bug（postgres-js 排队、node-postgres 报错、Neon 不可预测）
52. **99% 不嵌套**：嵌套 = SAVEPOINT，唯一价值是"内层失败不影响外层"，CRUD 场景一层 tx 就够
53. **upsert 用 `onConflictDoUpdate`**：`DoNothing` 不返回冲突行，`DoUpdate` 配无害 set 强制 RETURNING
54. **`tx?: any` 是反模式**：用 Drizzle 暴露的 `PgTransaction` 类型或推导

**树形数据批量扁平化**
55. **嵌套来自数据形状是树**：5 层缩进的根因不是技术，是你按深度优先在写
56. **翻译成广度优先 + 批量插入**：先全部 user → 全部 post → 全部 tag → 全部 link，4 条 SQL 替代 N×M×K 条
57. **`flatMap + Map(id→entity)` 是核心模式**：JS 里展平 + 反查表，对应 SQL 的批量插入
58. **一次往返插 100 行 ≈ 插 1 行**：网络 + 解析才是瓶颈，行数本身基本免费
59. **UUID 解链式依赖**：提前在 JS 生成所有 ID，所有插入完全无序、可并行（但索引体积代价）
60. **chunk 兜底**：超过几千行的批量切 500 一片，避免撞 max_locks / 网络包上限

**Neon 驱动选型（Part 4 实战补充）**
69. **neon-http 不支持事务**：每条 SQL 是独立 HTTP 请求，无法维持 `BEGIN → SQL → COMMIT` 的 session 状态
70. **事务需要同一连接**：这是 HTTP 无状态本质的矛盾，不是 bug 是设计权衡
71. **WebSocket 模式三约束**：请求内创建销毁 / Node ≤21 需 polyfill / 冷启动多一次 RTT
72. **HTTP 模式的 `sql.transaction([...])` 是非交互式**：一次性发所有 SQL，不能根据中间结果分支
73. **Drizzle + Neon 事务推荐 `postgres-js`**：`drizzle-orm/postgres-js` + `postgres` 包，改两行 index.ts 即可

**PostgreSQL ON CONFLICT (UPSERT)**
61. **`target` = 监听哪个 unique 冲突**：必须严格对应表上某个 unique constraint，普通 index 不行
62. **`EXCLUDED` 是 PG 临时伪表**：代表"本来要插入的那行"，只在 ON CONFLICT 子句内可用
63. **`DoNothing` 不返回冲突行，`DoUpdate` 返回所有行**：批量 upsert 拿 id 必须用 DoUpdate
64. **`set: { name: sql\`excluded.name\` }` 是"无害更新触发 RETURNING"的标准姿势**
65. **VALUES 内部不能有重复 conflict key**：必须先去重再批量插，否则 `cannot affect row a second time`
66. **复合 unique 的 target 必须字段集严格相同**：少字段或多字段都报错
67. **`where` 子句可以做条件 upsert**：例如 `where: sql\`tags.count < excluded.count\`` 只在新值更大时更新
68. **4 个生产配方**：counter +=1 / 时间戳刷新 / JSONB 合并 / 批量拿 id —— 覆盖 90% UPSERT 场景

---

## Muscle Memory 关联（与 6 个月路线对齐）

| 本目录知识点 | 对应 Layer 4 muscle memory |
|---|---|
| Zod schema + 入口校验（笔记 09） | 第 5 项「tool 定义的 zod schema + execute 函数签名」 |
| Server Action 三段式 + repository 分层（笔记 09） | 第 7 项「正确的 Server Action（含 auth + 错误 envelope）」 |
| 复杂 SQL 查询能力（笔记 06-09） | 第 7 项「正确的 Server Action」的 DB 子项 |
| Cursor pagination + URL state（笔记 02、10） | M2 W5-6 SSE parser 的 stream 增量游标同源 |
| useTransition + router.push（笔记 10） | 第 11 条「useTransition」的实战应用 |
| DTO 转换（笔记 09） | Anthropic Messages API 请求/响应映射同源 |
| Transaction 三铁律（笔记 04、12） | Stripe 状态机、Agent 多步 tool call 的原子性 |
| 树形 → 批量扁平（笔记 13） | 第 2 项「Tool use 完整报文流」的对话历史展平、第 4 项「ReAct loop」的 trace 持久化 |
| App Router import 边界（笔记 11） | 通用「framework migration 期间的隐性 bug」识别能力 |

---

## Day-04 收官回顾

Day-04 完整覆盖了从 **基础理论**（filter + JOIN + 分页 + 事务）到 **API 边界**（Drizzle relational vs builder）到 **生产架构**（CQRS-lite + Repository + DTO）到 **页面实战**（URL state + 分页器 + transaction 正确写法 + 批量扁平化）的全链路。

下一步建议（Day-05）：
- 把 13 篇笔记里的 muscle memory 标注串成一张总表
- 用其中 1-2 个 pattern 写自检题（闭卷重写）
- 把 demo 升级到「**用 Zod + Repository 三层架构**」全员标准化（笔记 09 的姿势）
