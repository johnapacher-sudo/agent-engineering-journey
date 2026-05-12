# drizzle-kit pull 的产物位置陷阱

## 一句话结论

`drizzle-kit pull` **会自动生成 `schema.ts`**，但生成到 **`out` 目录**（默认 `migrations/`），**不会写到你 `drizzle.config.ts` 里 `schema` 配置指向的位置**。

## 实测验证

```bash
pnpm drizzle-kit pull
```

跑完后看 `migrations/` 目录：

```
migrations/
├── 0000_xxxx.sql       ← SQL migration
├── schema.ts           ← ✅ 自动生成的 schema 定义（你以为没有的那个）
├── relations.ts        ← ✅ 自动生成的 relations 定义
└── meta/               ← snapshot（给后续 generate 用）
```

## 为什么不直接写到 `db/schema.ts`？

drizzle.config.ts 的两个配置项**语义不对称**：

| 配置 | 含义 | `pull` 命令的行为 |
|---|---|---|
| `schema: "./db/schema.ts"` | "我的 schema 源代码在哪" —— 给 `generate` / `migrate` 用 | **`pull` 不会写这个文件** |
| `out: "./migrations"` | "所有产物的输出目录" | `pull` 把 schema.ts + relations.ts + SQL + meta 都丢这里 |

设计哲学：**生成的东西放 `out`，手写的东西放 `schema`，工具不替你覆盖手写代码**。

如果 `pull` 直接覆盖 `db/schema.ts`，你手动加的注释、自定义类型、relations 全被冲掉——风险太大。

## 标准工作流（如何"接管"产物）

### 场景 A：全新项目，直接拿 pull 的结果当 schema

```bash
mkdir -p db
mv migrations/schema.ts db/schema.ts
mv migrations/relations.ts db/relations.ts
```

然后修一下 `db/index.ts`：

```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import * as relations from "./relations";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema: { ...schema, ...relations } });
```

之后**以 `db/schema.ts` 为唯一真源**，再有变更走 `generate` 路线。

### 场景 B：已经手写了 schema.ts，pull 只是为了对照

`pull` 出来的 `migrations/schema.ts` 当**参考**用——看看 DB 实际是什么样，对比你手写的有没有漂移（drift）。看完手动删掉。

## 4 个 drizzle-kit 命令的对比

| 命令 | 方向 | 输入 | 输出 |
|---|---|---|---|
| `pull` / `introspect` | DB → 代码 | 现有数据库 | `out/schema.ts` + `out/*.sql` + meta |
| `generate` | 代码 → SQL | `schema.ts` 改动 | `out/*.sql`（新 migration）+ meta |
| `migrate` | SQL → DB | `out/*.sql` | DB 被修改，写 `__drizzle_migrations` 表 |
| `push` | 代码 → DB（跳过 SQL） | `schema.ts` | DB 直接被修改（不走 migration 文件） |
| `studio` | DB → UI | DB | 浏览器可视化（127.0.0.1） |

**两条最常见路线**：

```
路线 1（生产推荐）：schema.ts 改 → generate → 人工 review SQL → migrate → DB
路线 2（开发快速）：schema.ts 改 → push → DB
```

`pull` 是**反向**的——只有"接手已存在 DB 的项目"或"对照 DB 现状"才用。

## 心法

1. **`schema` 配置 ≠ `pull` 的输出位置**。`schema` 是给"我手写的代码在哪"用的，`pull` 把生成物放 `out`。
2. **drizzle-kit 不会替你覆盖手写代码**——这是好事。
3. **pull 后要手动接管**：mv schema.ts 到 db/ 下，让它成为单一真源。

## 自检题

1. 如果你跑 `pull` 时 `db/schema.ts` **已经存在**，drizzle-kit 会覆盖它吗？为什么？
2. `pull` + `generate` 组合用，会有什么奇怪的事情发生？（提示：跟 `meta/_journal.json` 里记录的"上一个 snapshot 状态"有关）
3. 真实工作里你**什么场景**会用 `pull`？（提示：通常不是"我自己开发的项目"——想想接手 legacy 系统）
