# 17 · Use the Index, Luke! Ch.3 读书笔记

> 原文：[use-the-index-luke.com Ch.3 — The Equals Operator](https://use-the-index-luke.com/sql/where-clause/the-equals-operator)
> 核心：`=` 是最常见的 SQL 操作符，也是最容易用错索引的地方。

---

## 3.1 主键等值查询：两阶段 B-Tree 查找

### 两步流程

```
1. Index Tree Traversal（索引树遍历）
   → 沿 B-Tree 根节点往下走，O(log n)
   → 产生 INDEX UNIQUE SCAN

2. Table Access（取表数据）
   → 拿索引里的 rowid 回表取实际列
   → 产生 TABLE ACCESS BY INDEX ROWID
```

### 核心性质

**B-Tree 对数查找几乎不受表大小影响**。100 万行和 1 亿行的主键等值查询时间差别很小。

> "INDEX UNIQUE SCAN 不会触发多行表访问，不存在慢查询风险。"

主键唯一 → 索引最多返回 1 条 → 最多 1 次回表 → 永远快。

### 不同 DB 的执行计划显示

| DB | 显示方式 |
|---|---|
| Oracle | 两行清晰：`INDEX UNIQUE SCAN` + `TABLE ACCESS BY INDEX ROWID` |
| MySQL | 一个 `const` 类型（恒定时间） |
| Postgres | 合并成一个 `Index Scan` |

---

## 3.2 复合索引（本章重点）

### 开篇故事

公司被收购后员工表扩大 10 倍，`employee_id` 不再唯一，加 `subsidiary_id` 组复合主键：

```sql
CREATE UNIQUE INDEX employees_pk
  ON employees (employee_id, subsidiary_id);
```

新查询**慢如扫全表**：

```sql
SELECT first_name, last_name
  FROM employees
 WHERE subsidiary_id = 20;   -- 索引用不上！
```

### 为什么：索引物理排序

**电话簿比喻（官方）**：

> 复合索引像电话簿，先按姓排序，同姓再按名排序。
> 你**没法只按名字**查 —— "叫三"的分散在各姓下。

`(A, B)` 索引在磁盘上按 A 排序，A 相同再按 B 排序。B 单独查询等于扫全表。

### 最左前缀原则

三列索引 `(A, B, C)` 加速范围：

| 查询 | 用得上吗 |
|---|---|
| `WHERE A = ?` | ✅ |
| `WHERE A = ? AND B = ?` | ✅ |
| `WHERE A = ? AND B = ? AND C = ?` | ✅ |
| `WHERE B = ?` | ❌ |
| `WHERE C = ?` | ❌ |
| `WHERE B = ? AND C = ?` | ❌ |

**规则**：查询必须包含"最左边若干列"。

### 修复方案：反转列顺序

```sql
CREATE UNIQUE INDEX employees_pk
  ON employees (subsidiary_id, employee_id);
```

现在 `WHERE subsidiary_id = 20` 走 `INDEX RANGE SCAN`，同 subsidiary 的员工在索引里**连续存储**。

### Postgres 特有：Bitmap Scan

Postgres 执行计划常见两步：
1. **Bitmap Index Scan** — 扫索引收集所有候选 rowid，建 bitmap
2. **Bitmap Heap Scan** — 按物理位置顺序回表（减少随机 IO）

看到 Bitmap 别慌，是 Postgres 的优化手段。

---

## Markus Winand 的四条核心建议

### 1. 列顺序是权衡艺术

> "要做出最优索引，必须了解应用怎么查数据。"

你得看 WHERE 子句里哪些列**总是一起出现**，把它们按频率放左边。

### 2. 单个精心设计的复合索引 > 多个单列索引

省磁盘、省写入维护、优化器不会选错。一条覆盖多前缀的索引效果最好。

### 3. 索引是开发者的责任

> "只有开发部门同时拥有技术知识和业务理解，能在无需外部顾问的情况下正确索引。"

索引不是 DBA 的事，是写代码的人的事 —— 因为只有你知道查询模式。

### 4. 可视化验证法

按索引列排序 + `LIMIT 100` → 看目标行是否聚集在一处。
**若分散在各处，索引失效**。

---

## 3.3 慢索引陷阱第二部分（原文 404 未抓到）

从上下文推断（续第一章 slow indexes）：

- **光有索引不等于快** —— 要看是否被用上、是否最优
- 索引存在但优化器选了别的（统计信息陈旧）
- 索引太多反而让优化器乱选
- 复合索引顺序不对，看起来"用上了"实际扫大量行

---

## 带走三件事

1. **主键等值查询永远快**，不用担心
2. **复合索引 = 电话簿**，顺序决定能加速哪些查询
3. **列顺序决定论**：把"总是出现在 WHERE 里的列"放最左

和本目录笔记 10 / 14 / 16 是同一主题的深化，这里的"电话簿比喻"和 Markus 四条建议是原书核心。
