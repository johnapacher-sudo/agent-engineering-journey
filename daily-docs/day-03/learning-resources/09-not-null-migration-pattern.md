# NOT NULL 迁移：Expand-Contract 模式

## 一句话结论

**对已有数据的表加 NOT NULL 约束**，不能直接 `ALTER COLUMN SET NOT NULL`。生产标准做法是 **Expand-Contract Pattern**（也叫 Parallel Change，Martin Fowler 命名）—— 4 步走，保证服务不中断、可回滚。

## 场景：直接 ALTER 会怎样

```sql
ALTER TABLE posts ALTER COLUMN user_id SET NOT NULL;
```

**问题 1：现有数据有 NULL**

```
ERROR: column "user_id" of relation "posts" contains null values
```

**问题 2：即使没 NULL，PG 12 之前会锁表**

- 拿 ACCESS EXCLUSIVE 锁（阻塞所有读写）
- 全表扫描验证无 NULL
- 表越大锁越久—— 10 亿行可能锁 30 分钟+
- 生产期间这相当于"全站宕机"

## Expand-Contract 4 步法

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   1.Expand   │ →  │  2.Backfill  │ →  │  3.Migrate   │ →  │  4.Contract  │
│   加字段     │    │   补数据     │    │  加约束      │    │   清理       │
│   可空       │    │              │    │  NOT NULL    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Step 1: Expand —— 加字段，可空

```sql
ALTER TABLE posts ADD COLUMN user_id INTEGER REFERENCES users(id);
```

**部署节奏**：
1. 先跑 DB migration（加列，老代码不受影响）
2. 部署新代码，**新写入必须填 user_id**（应用层校验，DB 仍允许 NULL）
3. 老的读路径要兼容 NULL（"unknown author"）

**关键**：DB 改完 → 代码改完，之间空窗里**老代码继续跑、新代码逐步上线**。任何一步问题都能回滚——因为列还是 nullable。

### Step 2: Backfill —— 补老数据

业务决定怎么补：

| 老数据情况 | 补法 |
|---|---|
| 能从日志/session 推断 | 写脚本根据日志关联 |
| 完全无法关联 | 建 `system` / `legacy` user，所有孤儿数据归他 |
| 老数据不重要 | 直接 archive 到 `posts_archive` 表 |
| 数据极少 | 手工 / Excel 人工标注 |

**关键技术细节 —— 分批跑，不能一句 UPDATE**：

```sql
-- ❌ 错误：锁住整张表几分钟到几小时
UPDATE posts SET user_id = 1 WHERE user_id IS NULL;

-- ✅ 正确：分批 1000 行一批，每批 commit
DO $$
DECLARE
  batch_size INTEGER := 1000;
  affected INTEGER;
BEGIN
  LOOP
    UPDATE posts SET user_id = 1
    WHERE id IN (
      SELECT id FROM posts WHERE user_id IS NULL LIMIT batch_size
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;
    COMMIT;
    PERFORM pg_sleep(0.1);  -- 给在线流量留呼吸空间
  END LOOP;
END $$;
```

大公司用工具：**gh-ost**（GitHub）、**pt-online-schema-change**（Percona）、**Lhm**（Stripe）。

### Step 3: Migrate —— 加 NOT NULL（最坑的一步）

**生产正确的 3 步切换法**（避免长锁）：

```sql
-- Step 3a: 加 NOT VALID check（瞬时，不扫表，不锁表）
ALTER TABLE posts 
  ADD CONSTRAINT posts_user_id_check 
  CHECK (user_id IS NOT NULL) NOT VALID;

-- Step 3b: 后台慢慢 validate（只取共享锁，允许并发读写）
ALTER TABLE posts VALIDATE CONSTRAINT posts_user_id_check;

-- Step 3c: 瞬时完成（PG 已经知道全部 NOT NULL，元数据更新）
ALTER TABLE posts ALTER COLUMN user_id SET NOT NULL;

-- Step 3d: 删掉重复的 CHECK 约束（NOT NULL 已覆盖）
ALTER TABLE posts DROP CONSTRAINT posts_user_id_check;
```

PG 12+ 对 `SET NOT NULL` 自身做了优化—— **前提是先做了 NOT VALID check + validate**。所以这套套路在 PG 12+ 仍然有用。

### Step 4: Contract —— 清理

- 删掉应用代码里"兼容 NULL"的 fallback 分支
- 删掉 backfill 脚本
- 更新文档

## 危险操作清单（生产前必背）

| 危险操作 | 替代方案 |
|---|---|
| `ALTER COLUMN SET NOT NULL`（直接） | NOT VALID check → validate → SET NOT NULL |
| `ADD COLUMN xxx NOT NULL DEFAULT 'foo'` (PG11-) | PG 11+ 已优化；旧版本要 add nullable → backfill → not null |
| `CREATE INDEX` 不加 `CONCURRENTLY` | 加 `CONCURRENTLY` 避免阻塞写 |
| 重命名表/列 | expand-contract：加新列同步写两边 → 切读 → 删老列 |
| `DROP COLUMN` | 先停止写 → 几个 deploy 周期后再删 |
| 在 migration 里写大 `UPDATE` | 拆成 batched job |

## 工具推荐

- **[squawk](https://github.com/sbdchd/squawk)** — PostgreSQL migration linter
- **[Strong Migrations](https://github.com/ankane/strong_migrations)** — Rails 生态，思路通用
- **[gh-ost](https://github.com/github/gh-ost)** / **[pt-online-schema-change](https://docs.percona.com/percona-toolkit/pt-online-schema-change.html)** — MySQL 在线 schema 变更
- **[Neon Branching](https://neon.tech/docs/introduction/branching)** — 在 branch 上演练 migration

## 学习项目快速选项（vs 生产）

| 场景 | 学习项目 | 生产 |
|---|---|---|
| 数据是 faker 假数据 | `DELETE FROM posts;` 清掉重 seed | 不能删——expand-contract |
| 数据少（< 1000 行） | 单条 UPDATE 修复 | 分批 UPDATE |
| 数据多（> 100 万行） | （学习项目不会撞到） | 必须 expand-contract + batched backfill |

## 心法

1. **Migration 是"生产工程"问题**：开发环境通过的 SQL，生产可能 P0 事故。
2. **Migration 前必问 4 题**：
   - 这条 SQL 在生产规模上锁多久？
   - 锁期间什么写会失败？
   - 这次部署能 atomic 完成吗？
   - 如果新代码部署失败回滚，DB 改动还兼容老代码吗？
3. **学习 Neon Branching**：在 dev branch 上演练 migration，比看 100 篇博客有用。
4. **"add column NOT NULL DEFAULT" 在 PG 11+ 已优化**，但跨大版本部署的代码仍要按老规矩写。

## 自检题

1. 为什么"先加 NOT VALID check 再 validate"比"直接 SET NOT NULL"快？两者扫表行为本质区别？
2. expand-contract 的 4 步里，**哪一步是不可回滚的**？回滚意味着什么？
3. 如果是给 `email` 加 unique 约束（不是 NOT NULL），expand-contract 流程要做哪些调整？
