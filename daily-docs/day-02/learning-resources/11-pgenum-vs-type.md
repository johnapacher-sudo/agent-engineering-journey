# 11 · pgEnum vs `text().$type<>()`

## 本质区别

| | `pgEnum` | `text().$type<'a' \| 'b'>()` |
|---|---|---|
| 约束在哪层 | **数据库层**真实类型 | **仅 TS 编译时** |
| DB 校验吗 | 强约束，脏数据进不来 | 不校验，任何 string 都接受 |
| 加值 | 要 migration（`ALTER TYPE ADD VALUE`） | 改 TS 类型一行，不碰 DB |
| 删/改值 | **非常麻烦**（要重建类型） | 改 TS 一行 |

## `$type<>()` 是纯 TS 欺骗

它只在 TS 编译时有效。**以下场景都能塞脏数据**：
- 原生 SQL：`INSERT ... VALUES ('🍌')`
- `db.execute(sql\`...\`)` 绕过类型
- 另一个服务（Python/Go）写同一张表
- DBA 在 psql / Drizzle Studio 手动改

`pgEnum` 则是数据库层硬约束，以上场景都会被拒绝。这是本质区别。

## pgEnum 的真正痛点

**加值很简单**：

```sql
ALTER TYPE status_type ADD VALUE 'archived';
```

一条语句，无锁，很快。

**痛的是删/改值**：

```sql
-- ❌ Postgres 不支持
ALTER TYPE status_type DROP VALUE 'draft';  -- 报错
```

要删值得走"重建类型"的完整流程：新建 enum → 把所有用到旧 enum 的字段改成新 enum → 删旧 enum。四五步 SQL，生产上需要表锁，有风险。

**所以 `pgEnum` 适合"增量加值"的场景，"减值/改值"场景痛。**

## 想"灵活 + DB 兜底" → text + CHECK

```typescript
status: text('status').notNull(),
// 表级约束
checkStatus: check('status_valid',
  sql`${status} IN ('draft', 'published', 'archived')`
),
```

CHECK 也是 DB 层约束，改它同样要 migration，但比 pgEnum **更灵活**（可以写任意布尔条件，不只是枚举）。

## 三方案演化成本对比

假设现在有 `draft / published`，要加 `archived`：

| 方案 | 改 schema.ts | 生成 migration | 应用到 DB | 风险 |
|---|---|---|---|---|
| `pgEnum` | 加一个数组值 | 生成 `ALTER TYPE ADD VALUE` | 跑 migrate | 低（加值无锁） |
| `$type<>()` | 改 TS 字面量类型 | **不用生成** | **不用 migrate** | 零 DB 改动 |
| `text + CHECK` | 改 TS + 改 CHECK | 生成 `ALTER TABLE DROP/ADD CONSTRAINT` | 跑 migrate | 中（CHECK 重建要验证现有数据） |

## 决策表

| 场景 | 推荐 |
|---|---|
| Agent 应用，status 高频演化 | **`$type<>()`** |
| 多服务写同一张表（Python + Node 共存） | **`pgEnum`** 或 CHECK |
| 稳定的核心业务（订单/支付状态） | **`pgEnum`**（值集几乎不变） |
| 想灵活又想 DB 兜底 | **text + CHECK** |
| 纯内部、早期快速迭代 | **`$type<>()`**（默认首选） |

## Agent 场景为什么特别适合 `$type<>()`

Agent 的 status 经常演化：

```
pending → thinking → tool_calling → waiting_tool_result → streaming
       → completed / failed / cancelled / tool_denied
       → retry_backoff / rate_limited / ...
```

开发前期根本不确定最终多少状态，每周可能加 1-2 个或拆分状态。

- **用 `pgEnum`**：每次加状态都是 migration + 部署 → 拖慢迭代
- **用 `$type<>()`**：改 TS 一行，push 代码 → 秒级扩展

这是"**演化频率 vs 约束强度**"的权衡。开发早期和高频迭代期，演化频率的收益 > 强约束的收益。

## 回退成本不对称（重要）

- `pgEnum → text`：**容易**（只是把列类型改回 text，enum 定义删掉）
- `text → pgEnum`：**麻烦**（要检查现有数据没有超出新 enum 的值，可能要清洗数据）

**启示**：不确定的时候，先用 `text + $type<>()`，等稳定了再收口到 `pgEnum`。**单向门优先用可逆选项**。

## 何时收口到 pgEnum

三个触发条件：

1. **状态集合稳定了**（上线半年后不再新增）
2. **出现多端写入**（非 TS 服务也写这张表，纯 TS 约束保护不了）
3. **发生过脏数据事故**（`'activ'` 拼错进数据库修了一下午）

这时候可以做一次"收口 migration"，把 `text` 换成 `pgEnum`。

## 一句话总结

- **pgEnum** = DB 层强约束，改/加值要 migration，适合稳定、多端写入、高约束场景
- **`$type<>()`** = 纯 TS 类型提示，DB 无约束，适合演化频繁、单端写入场景
- Agent 应用初期推荐 **`$type<>()`**，status 稳定后再考虑收口到 `pgEnum`
