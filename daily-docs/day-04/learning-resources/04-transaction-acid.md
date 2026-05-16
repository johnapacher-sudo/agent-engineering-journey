# Transaction 跨表原子操作

## ACID 四要素

### A — Atomic（原子性）

**"一组操作要么全成功，要么全失败，不存在中间态"**

```ts
// ❌ 没有事务保护
await db.insert(users).values({ name: 'Tom' });        // ✅ 成功
await db.insert(userSettings).values({ userId: 1 });   // ❌ 报错了！
await db.insert(wallets).values({ userId: 1 });         // ⚠️ 没执行
// 结果：用户创建了，但没有设置也没有钱包 —— 数据不一致

// ✅ 有事务保护
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({ name: 'Tom' }).returning();
  await tx.insert(userSettings).values({ userId: user.id });
  await tx.insert(wallets).values({ userId: user.id, balance: 100 });
  // 任何一步失败，上面全部回滚
});
```

实现原理：数据库维护 **undo log**（回滚日志）。事务里的每一步修改先记在日志里，不立即生效。全部成功才 commit（应用日志），任何一步失败就 rollback（用 undo log 还原）。

### C — Consistent（一致性）

**"事务前后，数据库约束必须始终满足"**

约束 = 外键、唯一索引、NOT NULL、CHECK 等。

```
例 1：外键约束
  orders 表有 userId 外键指向 users 表
  → 删除 user 42 时，如果 orders 里还有其订单，事务会失败

例 2：唯一约束
  users 表 email 有唯一索引
  → 并发插入同一 email，后 commit 的违反约束，事务失败
```

一致性不是数据库单独保证的，是 A + I + D + 你定义的约束共同保证的。

### I — Isolated（隔离性）

**"并发事务互不干扰"**（详见 [05-isolation-mvcc.md](./05-isolation-mvcc.md)）

### D — Durable（持久性）

**"commit 后即使断电也不丢"**

```
事务 commit 的瞬间：
1. 修改写入 WAL（Write-Ahead Log，预写日志）—— 顺序写磁盘，极快
2. WAL 刷盘确认（fsync）—— 这一步完成才算 commit 成功
3. 返回客户端"commit 成功"
4. 后台慢慢把修改写到实际的数据文件（不必等）
```

即使 commit 后立刻断电，重启时 PG 会用 WAL 重放恢复已 commit 的修改。

## return vs throw

```ts
// return = commit 已做的操作
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'Tom' });  // ✅ 已执行
  return { ok: true };  // 正常结束，上面 INSERT 被 commit
  await tx.insert(users).values({ name: 'Jerry' }); // 不会执行
});
// Tom 进了数据库

// throw = rollback 全部操作
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'Tom' });  // ✅ 已执行
  throw new Error('oops');  // 异常，触发 rollback
});
// Tom 没进数据库，整个事务回滚
```

## 自增 ID 回滚后的跳跃

```
事务 1：INSERT → 拿到 id=100 → ROLLBACK（数据没了）
事务 2：INSERT → 拿到 id=101（不是 100）
```

序列的递增操作**不在事务保护范围内**。原因是性能——如果序列也参与回滚，高并发下所有事务要争抢同一个序列锁，吞吐量暴跌。

ID 跳跃是正常现象，所有生产数据库都有这个行为。ID 的唯一职责是标识行，不是保证连续。

## 四要素关系

```
A（原子性）：失败时怎么回滚 → undo log
I（隔离性）：并发时怎么互不干扰 → 锁 + MVCC
D（持久性）：成功时怎么不丢 → WAL + fsync
C（一致性）：上面三个 + 约束定义 → 共同保证数据始终合法
```

C 更像一个**结果要求**，数据库通过 A、I、D 和约束检查来确保 C。

## Agent 场景：多步 Tool Call 的原子提交

Agent 一次推理可能调用多个 tool：

```
Tool 1: 从库存表扣减 1 件商品
Tool 2: 在订单表创建一条订单
Tool 3: 在支付表创建支付记录
```

如果 Tool 2 失败了，Tool 1 已经扣了库存——数据就乱了。用 transaction 包起来，任何一步失败全部回滚。

## 代码模板

```ts
await db.transaction(async (tx) => {
  // 所有操作都用 tx 而不是 db
  const [user] = await tx.insert(users).values({ name: 'Tom' }).returning();
  await tx.insert(userSettings).values({ userId: user.id });
  await tx.insert(wallets).values({ userId: user.id, balance: 100 });

  // 可以手动控制
  // throw new Error('something wrong') → 自动回滚
  // 正常执行完 → 自动 commit
});
```
