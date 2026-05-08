# Migration（数据库迁移）

## 为什么需要 Migration

核心问题：代码有 Git 管版本，但数据库结构变了怎么办？

### 具体场景

产品上线了，数据库里有 `users` 表，1000 个真实用户。现在要加手机号字段。

**错误做法**：删表重建（1000 个用户数据全没了）

**正确做法**：用 ALTER 语句改表结构，不动数据

```sql
ALTER TABLE users ADD COLUMN phone text;
```

执行后：

```
| id | email        | name  | phone  |
|----|-------------|-------|--------|
| 1  | a@b.com      | Alice | NULL   |  ← 老数据还在，phone 是空的
| 2  | c@d.com      | Bob   | NULL   |  ← 同上
```

**这条 ALTER 语句，就是一个 migration。**

### 为什么不手动执行 SQL

因为团队有多个人、多个环境：

```
你的本地数据库：结构可能是最新的
同事的本地数据库：上周 pull 的代码，结构落后了
测试环境数据库：跑着测试数据
生产环境数据库：跑着真实用户数据
```

Migration 文件解决了这个问题：每个数据库结构变更都存成 SQL 文件，跟着代码一起 Git 提交。

```
drizzle/
  0001_create_users_table.sql      ← 第一步：建表
  0002_add_phone_column.sql        ← 第二步：加列
```

每个人 pull 代码后跑 `pnpm drizzle-kit migrate`，Drizzle 自动检查这个数据库跑过哪些 migration，还缺哪些没跑，按顺序补上。

**本质：把数据库结构变更用文件管理起来，跟着代码走，让所有环境的数据库都能安全、可重复地升级到最新结构。**

## Migration 的两种流派

### 流派一：generate + migrate（两步走）

```
schema.ts（你写的代码）
       ↓
  第一步：generate（Drizzle 对比 schema.ts 和上次的快照，生成 SQL 文件）
       ↓
  0002_add_phone_column.sql（可以看、可以改、可以审查）
       ↓
  第二步：migrate（执行 SQL 文件，真正改数据库）
```

### 流派二：push（一步到位）

```
schema.ts（你写的代码）
       ↓
  push（Drizzle 直接把 schema.ts 同步到数据库，跳过生成 SQL 文件）
```

### 类比

| | generate + migrate | push |
|---|---|---|
| 类比 | 改完代码 → 先预览 → 确认没问题 → 发布 | 改完代码 → 直接上线 |
| 速度 | 慢一步 | 快 |

### 两种方式"同步"的原理不同

**migrate：靠 SQL 文件链**

```
数据库当前状态：0001
需要到达：0002
做法：找到 0001→0002 的 SQL 文件，执行它
依赖：必须有那几个 SQL 文件
```

**push：靠 schema.ts 本身**

```
数据库当前状态：0001 的表结构
schema.ts 写的是：0002 的表结构
做法：Drizzle 直接对比"数据库现在长什么样"和"schema.ts 要它长什么样"，然后 ALTER 到位
依赖：只需要 schema.ts 文件（在 Git 里）
```

两种方式都能同步多人环境，只是 push 是"直接看终点来调整"，migrate 是"按历史步骤一步步走"。

### 为什么生产环境不该用 push

1. **没有历史记录**——不知道数据库经过了哪些变更才变成今天的样子
2. **不可审查**——生产环境执行了什么 SQL，没留档
3. **不可回滚**——migrate 可以反向执行 SQL 回退，push 没有"撤销"
4. **生产环境风险大**——push 是 Drizzle 自动算 diff 来改表，复杂变更可能出意外

本地开发、做原型用 push 没问题，数据都是假的，坏了重建就行。
