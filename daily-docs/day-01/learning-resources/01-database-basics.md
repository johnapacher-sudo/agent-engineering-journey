# 数据库基础概念

## 关系型数据库（Postgres）

把 Postgres 想象成一个**远程的、结构化的 JSON 存储**。

- 前端习惯：`localStorage` / `IndexedDB` 在浏览器里存数据
- Postgres：跑在服务器上，数据存在**表（table）**里，类似 Excel 表格
- 每张表有固定的**列（column）**，每行是一条记录
- 表和表之间可以有关联（所以叫"关系型"）

```
users 表：
| id (自增主键) | email          | name   | created_at         |
|--------------|----------------|--------|--------------------|
| 1            | a@b.com        | Alice  | 2026-05-08 10:00   |
| 2            | c@d.com        | Bob    | 2026-05-08 11:00   |
```

Postgres 是目前最流行的开源关系型数据库之一，功能强大且免费。

## 连接字符串（Connection String）

就是一个 URL，告诉代码"数据库在哪、用什么账号连"：

```
postgresql://username:password@hostname:5432/database_name?sslmode=require
```

类似前端的 `VITE_API_URL`，存放在 `.env.local` 里，不会提交到 Git。

## 核心认知：代码和数据库的生命周期不一样

前端代码是**无状态**的：部署完旧版本就没了，全世界跑的都是新版本。Git 记住了历史，但运行时只看最新版。

数据库是**有状态的**——里面有真实的用户数据。你不能像换代码一样"把旧数据库删了，换个新的"。

这个区别是理解 Migration、连接池等所有后续概念的基础。
