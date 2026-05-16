# Elasticsearch 深翻页方案

## 为什么搜索引擎快？

PostgreSQL 的 OFFSET 慢是因为逐行计数——要走 B-tree 索引一个一个数到第 100000 条。

Elasticsearch 内部是**倒排索引 + 有序数组**：

```
PostgreSQL（按销量排序）：
  索引里按 sales 排好序，但要"跳过前 100000 条"得一步步走
  [商品A:9999] → [商品B:9998] → ... → 走 100000 步 → [取 20 条]

Elasticsearch（按销量排序）：
  已经有一段按 sales 排好序的连续内存数组
  "第 5000 页" = 数组下标 [99980, 100000)，直接算偏移取
  O(1) 定位，不需要"走过去"
```

本质区别：PG 的索引是树结构（要遍历），ES 的排序数据是连续数组（直接算下标）。

## 完整架构

```
                ┌─────────────────────────┐
                │       数据写入链路        │
                │                         │
                │  商品编辑 → PostgreSQL   │
                │       ↓                 │
                │  同步到 Elasticsearch    │
                │  (只同步搜索/排序需要的字段) │
                └─────────────────────────┘

                ┌─────────────────────────┐
                │       用户查询链路        │
                │                         │
用户搜索"手机" ──→│  API Server              │
排序:销量          │    ↓                    │
第5000页           │  查 Elasticsearch       │──→ 返回 [id1, id2, ...id20]
                  │  "手机, 按销量排序,     │
                  │   from=99980, size=20"  │
                  │    ↓                    │
                  │  拿 20 个 ID 查 PG       │──→ 返回 20 条商品完整信息
                  │  SELECT * FROM products  │
                  │  WHERE id IN (...)       │
                  │    ↓                    │
                  │  返回给用户              │
                  └─────────────────────────┘
```

ES 里存什么？**不是全量数据**，只存搜索和排序要用的字段：

```
Elasticsearch 文档（瘦索引）：
{
  "id": 42,
  "title": "iPhone 15 Pro",       // 用于搜索匹配
  "category": "手机",              // 用于分类筛选
  "price": 7999,                  // 用于排序、范围筛选
  "sales": 15000,                 // 用于排序
  "created_at": "2024-01-15"      // 用于排序
}

PostgreSQL（完整数据源）：
  id, title, description, images, stock, sku, specs,
  price, sales, category, created_at, updated_at ...
  （可能 30+ 个字段）
```

**关键流程**：ES 直接返回 20 个商品 ID（不是返回 cursor 值），PG 只负责 `WHERE id IN (...)` 取完整数据。按主键取 20 条永远走索引，毫秒级。

## 数据同步方案

### 方案 A：应用层双写（最简单）

```ts
async function updateProduct(id, data) {
  const [product] = await db.update(products)
    .set(data).where(eq(products.id, id)).returning();

  await esClient.index({
    index: 'products',
    id: product.id,
    body: {
      title: product.title,
      price: product.price,
      sales: product.sales,
      category: product.category,
    }
  });
}
```

缺点：两个写操作不是原子的，PG 成功 ES 失败会不一致。

### 方案 B：监听数据库变更（最常用）

```
PostgreSQL → WAL（写日志）→ Debezium / CDC 工具 → Kafka → Elasticsearch
```

应用只写 PG，通过监听 PG 的变更日志（WAL）自动同步到 ES。应用代码不需要关心 ES。

### 方案 C：定时全量/增量同步（最简单但有延迟）

```
每 5 分钟跑一次：
  SELECT * FROM products WHERE updated_at > 上次同步时间
  → 批量写入 ES
```

延迟几分钟，但对电商商品列表够用。

## 总结

- ES 负责"找到哪些 ID"，PG 负责"这些 ID 的完整数据是什么"
- 各干各擅长的事：搜索引擎负责排序+分页+全文检索，数据库负责事务+持久化+关联查询
