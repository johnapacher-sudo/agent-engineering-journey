# 01 · 关系的三种形态

## 核心判断方法

问自己两个问题：
1. A 的一行 → 对应多少 B？
2. B 的一行 → 对应多少 A？

| A→B | B→A | 形态 | 做法 |
|---|---|---|---|
| 1 | 1 | 一对一 | 一方加 FK + UNIQUE |
| 多 | 1 | 一对多 | "多"的那方加 FK |
| 多 | 多 | 多对多 | 独立中间表 |

## 1. 一对多（One-to-Many）

例子：一个 user 可以写多个 post，但每个 post 只属于一个 user。

```
users              posts
-------            -------
id                 id
name               title
                   user_id  ← 外键，指向 users.id
```

**规则**：**"多"的那一方加外键**。

为什么？如果在 users 表里加 `post_id`，一个 user 有 100 个 post，你就得在一行里存 100 个 id —— 违反第一范式（一个字段只能存一个值）。

查询：`SELECT * FROM posts WHERE user_id = 1`

## 2. 多对多（Many-to-Many）

例子：一个 post 可以有多个 tag，一个 tag 也能被多个 post 使用。

两边都是"多"，外键加在哪边都不对 → **开一张中间表**，只存两边的 id。

```
posts              posts_tags              tags
-------            -----------             -------
id                 post_id  ← FK           id
title              tag_id   ← FK           name
                   (post_id, tag_id) 组合唯一
```

中间表里每一行代表"一次关联"：`(5, 3)` 表示 post=5 贴了 tag=3。

## 3. 一对一（One-to-One）

例子：一个 user 有且只有一份 profile。

结构上像一对多（一方加外键），但**在外键字段上再加 `UNIQUE` 约束**，强制"最多一条"。
