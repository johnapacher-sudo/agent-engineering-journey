# drizzle-kit 命令速查

## 命令一览

| 命令 | 作用 | 动数据库？ |
|---|---|---|
| `generate` | 根据 schema 生成迁移 SQL 文件 | 否 |
| `migrate` | 执行迁移，把 SQL 应用到数据库 | 是 |
| `push` | 跳过迁移文件，直接同步 schema 到数据库 | 是 |
| `introspect` | 从已有数据库反向生成 TypeScript schema | 否（只读） |
| `studio` | 启动可视化数据库浏览器 | 否（只读/可编辑数据） |
| `check` | 检查迁移文件和数据库状态是否一致 | 否 |
| `up` | 手动改了迁移 SQL 后，更新元数据快照 | 否 |
| `drop` | 删除最近一次 generate 生成的迁移文件 | 否 |
| `export` | 导出完整 schema DDL（从空库到当前状态） | 否 |

## 详细说明

### `drizzle-kit generate` — 生成迁移 SQL

根据 schema.ts 和当前迁移历史的差异，自动生成 `.sql` 文件到 `drizzle/` 目录。

```bash
drizzle-kit generate
```

改了 schema 之后跑这个，会在 `drizzle/` 下生成类似 `0003_boring_silver_sable.sql` 的文件。不会动数据库，只是生成本地 SQL 文件。

生成的迁移文件结构：

```
drizzle/
  _meta/
  0000_premium_mister_fear.sql
  0001_absurd_toad.sql
  0002_adorable_human_torch.sql
```

### `drizzle-kit migrate` — 执行迁移

把 `generate` 生成的 SQL 文件应用到数据库。会自动记录哪些迁移已经执行过。

```bash
drizzle-kit migrate
```

前提：必须先 `generate` 过。Drizzle 在数据库里维护 `__drizzle_migrations` 表跟踪状态。

也可以在代码里用 Drizzle ORM 执行迁移：

```ts
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const db = drizzle(sql);
await migrate(db, { migrationsFolder: "drizzle" });
```

### `drizzle-kit push` — 直接推送 schema

跳过生成迁移文件，直接把 schema 同步到数据库。

```bash
drizzle-kit push
```

工作原理：
1. 从数据库拉取当前 schema，转成 drizzle 内部格式
2. 读取本地 schema 文件，转成同样格式
3. 对比差异，生成并执行必要的 SQL

适用场景：
- 本地快速原型开发，不想维护迁移文件
- 用 Neon / PlanetScale 等有自己迁移管理的外部服务
- 快速验证 schema 改动

和 `generate` + `migrate` 的区别：`push` 不生成 SQL 文件，不留迁移历史。

### `drizzle-kit introspect` — 从数据库反向生成 schema

连接已有数据库，读取表结构，自动生成 TypeScript schema 文件。

```bash
drizzle-kit introspect
```

适用场景：接手一个已有数据库的项目，没有 schema 文件，直接从数据库拉取。

### `drizzle-kit studio` — 可视化数据库浏览器

```bash
drizzle-kit studio
drizzle-kit studio --port 3000    # 自定义端口
drizzle-kit studio --host 0.0.0.0 # 自定义 host
drizzle-kit studio --verbose      # 显示所有 SQL 语句
```

在浏览器里浏览表数据、筛选、排序、编辑记录。需要 drizzle.config.ts 里有 `schema` 和 `dbCredentials`。

### `drizzle-kit check` — 检查迁移状态

验证生成的迁移文件是否有问题（比如和数据库当前状态不一致）。

```bash
drizzle-kit check
```

### `drizzle-kit up` — 更新迁移元数据

手动修改了迁移 SQL 文件后，跑这个来更新内部元数据快照，保持一致性。

```bash
drizzle-kit up
```

### `drizzle-kit drop` — 删除最近一次迁移

删除最后一次 `generate` 生成的迁移文件（只删最新的那个）。

```bash
drizzle-kit drop
```

### `drizzle-kit export` — 导出完整 DDL

生成当前 schema 对应的完整 DDL（从空库到当前状态的全部 SQL），不是增量差异。

```bash
drizzle-kit export
```

## 日常工作流

```
开发时快速迭代：  改 schema → push → 验证 → 重复
正式项目流程：    改 schema → generate → 检查 SQL → migrate
接手老项目：      introspect → 拿到 schema → 开始开发
```

`generate` + `migrate` 是正式项目的标准做法，有完整的迁移历史和版本控制。

## 配置文件

所有命令读取 `drizzle.config.ts`：

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  out: "./drizzle",          // 迁移文件输出目录
  verbose: true,
  strict: true,
})
```
