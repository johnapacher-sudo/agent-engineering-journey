# 连接池与 Neon Serverless

## 什么是数据库连接

Node.js 查数据库，要先建一条 TCP 连接：

```
Node.js  ──TCP 连接──→  Postgres
          (握手、认证、加密，耗时)
```

建连接有成本（网络往返、认证握手）。

## 连接池是什么

连接池是**数据库驱动（driver）在应用层**实现的，不是框架，也不是网络底层。

```
你的代码
  ↓ 调用
数据库驱动（比如 node-postgres / pg 这个 npm 包）
  ↓ 驱动内部维护了一个连接池
  ↓ 池子里的每条连接
TCP 连接 → Postgres
```

驱动内部简化逻辑：

```ts
class Pool {
  connections = []  // 空闲连接列表
  maxSize = 10      // 最多 10 条

  async query(sql) {
    // 有空闲连接？拿来用
    if (this.connections.length > 0) {
      const conn = this.connections.pop()
      const result = await conn.query(sql)
      this.connections.push(conn)  // 用完放回去
      return result
    }
    // 没有空闲且没到上限？新建一条
    if (this.allConnections.length < this.maxSize) {
      const conn = await newTCPConnection()  // 网络握手，耗时
      this.allConnections.push(conn)
      return conn.query(sql)
    }
    // 都满了？排队等
    await waitForAvailable()
  }
}
```

用 `pg` 包的时候，它默认就帮你建了一个连接池。

## 为什么在 Vercel Serverless 下会爆

连接池能工作的前提是**进程一直活着**。

```
传统服务器：进程启动 → 建连接池 → 一直跑 → 连接一直复用 ✅
```

Vercel Serverless **用完就销毁**：

```
用户 A 访问 → 启动进程 → 建连接 → 查数据 → 进程销毁，连接没关干净
用户 B 访问 → 启动进程 → 建连接 → 查数据 → 进程销毁，连接没关干净
...
```

连接池根本建不起来——进程都死了，池子也没了。每次都新建连接，旧连接可能没来得及释放。Postgres 最多比如 100 条连接，流量一大就满了 → 爆了。

## Neon 的解决方案

Neon 是云端的 Postgres 服务（类似前端的 Vercel——不用自己搭服务器）。

除了托管数据库，Neon 还提供了 HTTP 驱动：

```
传统 TCP：Node.js ←── TCP 长连接 ──→ Postgres（像打电话，一直保持）
Neon HTTP：Node.js ←── HTTP 请求 ──→ Neon（像发短信，发完就断）
```

核心思路是**把连接管理的责任从你的代码搬到 Neon 那边**：

```
Vercel 进程 ──HTTP请求──→ Neon 服务 ──内部连接池──→ Postgres

Vercel 这边：没有"连接"的概念，就是发了一个 fetch 请求
Neon 那边：常驻服务，内部维护连接池，帮你查 Postgres
```

不是"建更多连接"，而是代码层面根本不需要管连接了。

## HTTP 会不会比 TCP 慢

会。HTTP 每次都有网络往返开销：

```
TCP 长连接：复用后省掉握手开销，快
HTTP 每次请求：DNS → TCP 握手 → TLS 握手 → 发请求 → 查询 → 返回，有开销
```

但在 Serverless 场景下，TCP 也快不了——每次冷启动也要新建连接（握手本身就慢），反而 HTTP 更简单可靠。

Neon 官方数据：

| | TCP | HTTP |
|---|---|---|
| 单次查询延迟 | ~5ms | ~15ms |

慢了约 10ms，对网页请求（通常几百毫秒）用户感知不到。

## 一句话总结

| | 传统 Postgres | Neon |
|---|---|---|
| 谁管数据库 | 自己买服务器装 | Neon 云服务，注册就用 |
| 怎么查数据 | TCP 长连接（像打电话） | HTTP 请求（像发短信） |
| Vercel 上 | 每次冷启动建新连接，会爆 | 发完就断，不会爆 |
