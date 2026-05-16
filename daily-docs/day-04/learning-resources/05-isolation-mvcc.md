# 隔离级别与 MVCC

## 三个经典并发问题

| 问题 | 描述 |
|---|---|
| **脏读** | 事务 A 读到事务 B 还没 commit 的中间数据；B 回滚后 A 读到的是"从未存在"的数据 |
| **不可重复读** | 事务内两次读同一行，值变了（别人 commit 了修改） |
| **幻读** | 事务内两次查同一条件，行数变了（别人 commit 了新增/删除） |

## 四个隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 性能 |
|---|---|---|---|---|
| READ UNCOMMITTED | 可能 | 可能 | 可能 | 最高 |
| **READ COMMITTED（PG 默认）** | 不会 | 可能 | 可能 | 高 |
| REPEATABLE READ | 不会 | 不会 | 可能 | 中 |
| SERIALIZABLE | 不会 | 不会 | 不会 | 低 |

## 为什么不直接用 SERIALIZABLE？

隔离级别越高，并发性能越差。SERIALIZABLE 要求"结果等价于串行执行"，数据库会检测事务间冲突，发现冲突直接 abort 一个。

```
场景：秒杀，100 人抢最后 1 件商品

READ COMMITTED + FOR UPDATE：
  → 加行锁，排队依次处理，第 1 个成功，后面 99 个看到 stock=0 失败

SERIALIZABLE：
  → 检测到 100 个事务操作同一行，判定有依赖冲突
  → 大量事务被 abort，需要自己写重试逻辑
  → 高并发下大量"误杀"，吞吐量暴跌
```

生产中 99% 用默认 READ COMMITTED + 针对性加锁（`FOR UPDATE`）就够了。

## 设置隔离级别

```sql
-- 单个事务
BEGIN ISOLATION LEVEL SERIALIZABLE;
  -- 操作
COMMIT;

-- 会话级别
SET default_transaction_isolation = 'serializable';
```

## MVCC 原理

PG 不靠纯加锁实现隔离（太慢），用 **MVCC（多版本并发控制）**。

核心思路：**每个事务看到的是数据的一个"快照"，不同事务可能看到不同版本。**

### 每行的隐藏字段

```
 xmin  |  xmax  |  name  | balance
-------|--------|--------|--------
  100  |        |  Tom   |  1000       ← 第 100 号事务插入的，当前有效
  100  |  200   |  Tom   |  1000       ← 被 200 号事务更新了，已失效
  200  |        |  Tom   |  1500       ← 200 号事务插入的新版本
```

- `xmin`：创建这行的事务 ID
- `xmax`：删除/更新这行的事务 ID（空 = 当前有效）

### READ COMMITTED 的行为

**每条 SQL 语句都拿一个新快照**——能看到该语句执行时所有已 commit 的数据。

```
事务 A                                  事务 B
BEGIN;                                  BEGIN;
SELECT balance → 1000
                                        UPDATE balance = 800; COMMIT;
SELECT balance → 800（新快照，B 已提交）
COMMIT;
```

同一事务里两次 SELECT 看到不同结果 = "不可重复读"。

### REPEATABLE READ 的行为

**整个事务用一个快照**——事务开始时拍一张，之后所有语句都看这张快照。

```
事务 A（REPEATABLE READ）                事务 B
BEGIN;
// 快照时间点：balance = 1000
                                        UPDATE balance = 800; COMMIT;
SELECT balance → 1000（快照没变）
COMMIT;
```

### SERIALIZABLE 的行为

在 REPEATABLE READ 基础上，**额外跟踪事务之间的依赖关系**。

```
事务 A：读 balance → 1000
事务 B：读 balance → 1000
事务 A：UPDATE balance = 800 → COMMIT ✅
事务 B：UPDATE balance = 700 → COMMIT ❌

SERIALIZABLE 检测到 A 和 B 读写依赖同一行 → abort B
```

### 三种级别本质区别

```
READ COMMITTED：每条语句一个快照 → 看到最新的已提交数据
REPEATABLE READ：整个事务一个快照 → 看到事务开始时的数据
SERIALIZABLE：一个快照 + 依赖追踪 → 检测到冲突直接 abort
```

## 悲观锁（解决并发写冲突）

日常开发中，不需要提高隔离级别，用 `FOR UPDATE` 锁行就够了：

```ts
await db.transaction(async (tx) => {
  // FOR UPDATE：给这行加锁，其他事务排队等
  const [product] = await tx.select()
    .from(products)
    .where(eq(products.id, 42))
    .for('update');

  if (product.stock < 1) throw new Error('库存不足');

  await tx.update(products)
    .set({ stock: product.stock - 1 })
    .where(eq(products.id, 42));
});
```

MVCC 让读操作不加锁（看快照就行），写操作用行锁互斥。读写不互相阻塞。
